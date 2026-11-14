"use client";

import SubpageLayout from "../_subpage.js";
import ShieldCard from "../_components/ShieldCard.js";

export default function ShieldPage() {
  return (
    <SubpageLayout titleKey="shield_title" hintKey="shield_hint">
      <ShieldCard />
    </SubpageLayout>
  );
}
