"use client";

import { useCallback, useState } from "react";
import JSZip from "jszip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSensorData,
  fetchAllFiles,
  getExportCsvUrl,
  getExportJsonUrl,
  getDownloadUrl,
  formatBytes,
  formatTimestamp,
  type WAVFile,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

export default function ExportPage() {
  const sensorFetcher = useCallback(() => fetchSensorData(1000), []);
  const filesFetcher = useCallback(() => fetchAllFiles(), []);

  const { data: readings, loading: rl } = usePolling(sensorFetcher, 60000);
  const { data: files, loading: fl } = usePolling(filesFetcher, 60000);

  const totalSize = files?.reduce((sum, f) => sum + f.size, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Data</h1>
        <p className="text-sm text-muted-foreground">
          Download sensor data and recordings for analysis and ML training
        </p>
      </div>

      {/* Sensor data export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sensor Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Total readings:</span>
            {rl ? (
              <Skeleton className="h-5 w-12" />
            ) : (
              <Badge variant="secondary">{readings?.length ?? 0}</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Export all temperature, humidity, and recording metadata. Includes
            timestamp, temperature (C), humidity (%), WAV filename, sample rate,
            and device ID for every recording session.
          </p>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <a
              href={getExportCsvUrl()}
              download
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Download CSV
            </a>
            <a
              href={getExportJsonUrl()}
              download
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
            >
              Download JSON
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Recordings export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Audio Recordings</span>
            {!fl && files && (
              <span className="text-sm font-normal text-muted-foreground">
                {files.length} files &middot; {formatBytes(totalSize)} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download individual WAV recordings. Each file is 60 seconds of 16-bit
            mono audio captured from the beehive microphone.
          </p>

          <Separator />

          <BulkDownloadSection files={files ?? []} loading={fl} />

          <div className="overflow-x-auto">
            {fl ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !files?.length ? (
              <p className="py-8 text-center text-muted-foreground">
                No recordings yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...files]
                    .sort(
                      (a, b) =>
                        new Date(b.uploaded).getTime() -
                        new Date(a.uploaded).getTime()
                    )
                    .map((file) => (
                      <TableRow key={file.key}>
                        <TableCell className="font-mono text-sm">
                          {file.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimestamp(file.uploaded)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatBytes(file.size)}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={getDownloadUrl(file.key)}
                            download={file.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                          >
                            Download
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkDownloadSection({
  files,
  loading,
}: {
  files: WAVFile[];
  loading: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function downloadAllZip() {
    if (!files.length || downloading) return;
    setDownloading(true);
    setProgress({ done: 0, total: files.length });

    const zip = new JSZip();

    for (let i = 0; i < files.length; i++) {
      try {
        const res = await fetch(getDownloadUrl(files[i].key));
        const blob = await res.blob();
        zip.file(files[i].name, blob);
      } catch {
        // skip failed files
      }
      setProgress({ done: i + 1, total: files.length });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beesense-recordings.zip";
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  }

  if (loading || !files.length) return null;

  return (
    <div className="flex items-center gap-4">
      <Button onClick={downloadAllZip} disabled={downloading}>
        {downloading
          ? `Zipping ${progress.done}/${progress.total}...`
          : `Download All as ZIP (${files.length} files)`}
      </Button>
      {downloading && (
        <span className="text-sm text-muted-foreground">
          Fetching files and building ZIP...
        </span>
      )}
    </div>
  );
}
