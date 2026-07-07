"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { ChatPanel } from "@/components/ChatPanel";
import { DatasetPreview } from "@/components/DatasetPreview";
import { PreviewFrame } from "@/components/PreviewFrame";
import { UploadPanel } from "@/components/UploadPanel";
import type { ArtifactManifest, DatasetMetadata } from "@/lib/types";

export default function HomePage() {
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [artifact, setArtifact] = useState<ArtifactManifest | null>(null);

  return (
    <AppShell>
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 lg:grid-cols-[420px_1fr]"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex flex-col gap-6">
          <UploadPanel dataset={dataset} onDataset={setDataset} />
          <ChatPanel dataset={dataset} onArtifact={setArtifact} />
        </div>
        <PreviewFrame artifact={artifact} />
      </motion.section>
      <section className="mt-6">
        <DatasetPreview dataset={dataset} />
      </section>
    </AppShell>
  );
}
