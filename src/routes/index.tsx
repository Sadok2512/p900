import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { PolarisDataProvider } from "@/lib/polaris-api";
import { lazy, Suspense } from "react";

const PolarisApp = lazy(() => import("@/components/polaris/PolarisApp"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POLARIS Analyzer" },
      { name: "description", content: "POLARIS Analyzer : requêtes, ladder, corrélation et gestion des nœuds de capture." },
      { property: "og:title", content: "POLARIS Analyzer" },
      { property: "og:description", content: "Analyse de sessions 4G/5G et supervision des nœuds POLARIS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-background" />}>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <PolarisDataProvider><PolarisApp /></PolarisDataProvider>
      </Suspense>
    </ClientOnly>
  );
}
