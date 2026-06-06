"use client";

import { Suspense } from "react";
import WalletView from "@/components/views/WalletView";
import { Spinner } from "@/components/ui";

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <WalletView />
    </Suspense>
  );
}
