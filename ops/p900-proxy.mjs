import http from 'node:http';
import { readFileSync, readdirSync, statfsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const listenHost = process.env.P900_PROXY_HOST ?? '127.0.0.1';
const listenPort = Number(process.env.P900_PROXY_PORT ?? 8091);
const captureRoot = process.env.OIRAN_CAPTURE_SOURCE_ROOT ?? '/var/lib/docker/volumes/oiran_lab_pcap/_data';

function secretFromFile(name) {
  const path = process.env[name];
  if (!path) return null;
  try { return readFileSync(path, 'utf8').trim() || null; } catch { return null; }
}
const tokens = { oiran: secretFromFile('OIRAN_OPERATOR_TOKEN_FILE'), polaris: secretFromFile('POLARIS_OPERATOR_TOKEN_FILE') };
const cpuSample = { at: 0, usage: 0, percent: null };
const byteSamples = new Map();

export function targetFor(rawUrl = '/') {
  const pathname = new URL(rawUrl, 'http://localhost').pathname;
  if (pathname === '/api/v1' || pathname.startsWith('/api/v1/')) return { host: '127.0.0.1', port: 49152, scope: 'oiran', path: rawUrl };
  if (pathname === '/polaris-api/v1' || pathname.startsWith('/polaris-api/v1/')) return { host: '127.0.0.1', port: 49153, scope: 'polaris', path: rawUrl.replace('/polaris-api/v1', '/api/v1') };
  return { host: '127.0.0.1', port: 8090, scope: 'ui', path: rawUrl };
}

function forwardedHeaders(headers, target) {
  const forwarded = { ...headers };
  delete forwarded.authorization;
  delete forwarded.host;
  forwarded.host = `${target.host}:${target.port}`;
  const token = tokens[target.scope];
  if (token) forwarded.authorization = `Bearer ${token}`;
  return forwarded;
}

function logicalName(directory) {
  return ({ s1mme:'S1-MME', s1u:'S1-U', s5u:'S5-U', s5c:'S5-C', s11:'S11', s6a:'S6a', sxab:'Sxa/Sxb', n2:'N2', n3:'N3', n4:'N4', n6:'N6', sbi:'SBI', ims:'IMS' })[directory.toLowerCase()] ?? directory.toUpperCase();
}
function argAfter(args, flag) { const index=args.indexOf(flag); return index>=0 ? args[index+1] : null; }
function startedAt(pid) {
  try {
    const stat=readFileSync(`/proc/${pid}/stat`,'utf8').trim().split(/\s+/), ticks=Number(stat[21]);
    const btime=Number(readFileSync('/proc/stat','utf8').match(/^btime\s+(\d+)$/m)?.[1]);
    return new Date((btime+ticks/100)*1000).toISOString();
  } catch { return null; }
}
function latestSegment(directory) {
  try {
    const root=join(captureRoot,directory), files=readdirSync(root).filter(name=>name.endsWith('.pcapng')).map(name=>{ const path=join(root,name), stat=statSync(path); return {name,path,size_bytes:stat.size,modified_at:stat.mtime.toISOString(),mtime:stat.mtimeMs}; }).sort((a,b)=>b.mtime-a.mtime);
    if (!files.length) return null;
    const {mtime,...segment}=files[0]; return segment;
  } catch { return null; }
}

function segmentRate(interfaceName,segment) {
  if (!segment) return null;
  const now=Date.now(), previous=byteSamples.get(interfaceName);
  byteSamples.set(interfaceName,{path:segment.path,size:segment.size_bytes,at:now});
  if (!previous || previous.path!==segment.path || now<=previous.at || segment.size_bytes<previous.size) return null;
  return Math.max(0,Math.round((segment.size_bytes-previous.size)*1000/(now-previous.at)));
}

export function dumpcapRuntime() {
  const rows=[];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    let args; try { args=readFileSync(`/proc/${entry}/cmdline`).toString().split('\0').filter(Boolean); } catch { continue; }
    if (basename(args[0]??'') !== 'dumpcap') continue;
    const output=argAfter(args,'-w')??'', directory=output.split('/').filter(Boolean).at(-2)??'unknown';
    const interfaceName=logicalName(directory), segment=latestSegment(directory);
    rows.push({ interface:interfaceName, pid:Number(entry), active:true, started_at:startedAt(entry), device:argAfter(args,'-i'), bpf_filter:argAfter(args,'-f'), output_template:output, current_segment:segment, last_rotation:segment?.modified_at ?? null, bytes_per_second:segmentRate(interfaceName,segment) });
  }
  return rows.sort((a,b)=>a.interface.localeCompare(b.interface));
}

function cgroupMemory() {
  try { const values=Object.fromEntries(readFileSync('/sys/fs/cgroup/system.slice/oiran-api.service/memory.stat','utf8').trim().split('\n').map(line=>line.split(/\s+/))); return { memory_usage_bytes:Number(values.anon??0)+Number(values.file??0), memory_anon_bytes:Number(values.anon??0), memory_file_bytes:Number(values.file??0) }; } catch { return {}; }
}
function cgroupCpu() {
  try {
    const values=Object.fromEntries(readFileSync('/sys/fs/cgroup/system.slice/oiran-api.service/cpu.stat','utf8').trim().split('\n').map(line=>line.split(/\s+/)));
    const now=Date.now(), usage=Number(values.usage_usec??0); let percent=cpuSample.percent;
    if(cpuSample.at && now>cpuSample.at && usage>=cpuSample.usage) percent=(usage-cpuSample.usage)/1000/(now-cpuSample.at)*100;
    Object.assign(cpuSample,{at:now,usage,percent}); return {cpu_usage_percent:percent};
  } catch { return {}; }
}
function captureDisk() {
  try { const stat=statfsSync(process.env.OIRAN_DISK_PATH??'/'), total=Number(stat.blocks)*Number(stat.bsize), free=Number(stat.bavail)*Number(stat.bsize); return {disk_usage_percent:total>0?(total-free)/total*100:null,disk_free_bytes:free}; } catch { return {}; }
}

function sendJson(response,status,payload) { response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); response.end(JSON.stringify(payload)); }

function proxy(request,response,target) {
  const upstream=http.request({host:target.host,port:target.port,method:request.method,path:target.path,headers:forwardedHeaders(request.headers,target)}, upstreamResponse=>{
    const pathname=new URL(request.url??'/','http://localhost').pathname;
    const transform=target.scope==='polaris'||pathname==='/api/v1/probes';
    if (!transform) { response.writeHead(upstreamResponse.statusCode??502,upstreamResponse.headers); upstreamResponse.pipe(response); return; }
    const chunks=[]; upstreamResponse.on('data',chunk=>chunks.push(chunk)); upstreamResponse.on('end',()=>{
      let payload; try { payload=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { sendJson(response,upstreamResponse.statusCode??502,{error:{code:'INVALID_UPSTREAM_RESPONSE',message:'Invalid upstream response'}}); return; }
      if (target.scope==='polaris' && !('data' in payload)) payload={data:payload,meta:{}};
      if (pathname==='/api/v1/probes' && Array.isArray(payload.data) && payload.data[0]) payload.data[0]={...payload.data[0],role:payload.data[0].role??'Capture',last_seen:new Date().toISOString(),...cgroupMemory(),...cgroupCpu(),...captureDisk()};
      sendJson(response,upstreamResponse.statusCode??502,payload);
    });
  });
  upstream.on('error',()=>sendJson(response,502,{error:{code:'BACKEND_UNREACHABLE',message:'Backend unreachable'}}));
  request.pipe(upstream);
}

export function createServer() {
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url??'/','http://localhost').pathname;
    if (pathname==='/api/v1/interfaces/runtime') {
      if (request.method!=='GET') return sendJson(response,405,{error:{code:'METHOD_NOT_ALLOWED',message:'GET required'}});
      return sendJson(response,200,{data:dumpcapRuntime(),meta:{observed_at:new Date().toISOString()}});
    }
    proxy(request,response,targetFor(request.url));
  });
  server.on('upgrade',(request,socket,head)=>{
    const target=targetFor(request.url);
    const upstream=http.request({host:target.host,port:target.port,method:request.method,path:target.path,headers:forwardedHeaders(request.headers,target)});
    upstream.on('upgrade',(upstreamResponse,upstreamSocket,upstreamHead)=>{
      const status=upstreamResponse.statusCode??101;
      const lines=[`HTTP/${upstreamResponse.httpVersion} ${status} ${upstreamResponse.statusMessage}`];
      for(let index=0;index<upstreamResponse.rawHeaders.length;index+=2) lines.push(`${upstreamResponse.rawHeaders[index]}: ${upstreamResponse.rawHeaders[index+1]}`);
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      if(upstreamHead.length) socket.write(upstreamHead);
      if(head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(socket).pipe(upstreamSocket);
    });
    upstream.on('response',()=>socket.destroy());
    upstream.on('error',()=>socket.destroy());
    upstream.end();
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') createServer().listen(listenPort,listenHost,()=>console.log(`p900 proxy listening on ${listenHost}:${listenPort}`));
