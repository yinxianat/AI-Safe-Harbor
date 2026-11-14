"use client";

import SubpageLayout from "../_subpage.js";
import PasswordCard from "../_components/PasswordCard.js";
import DeleteAccountCard from "../_components/DeleteAccountCard.js";

/**
 * Account subpage.
 *
 * Password and delete-account live together because both are
 * low-frequency identity actions — a user who comes to /me/account
 * is here to secure their account or remove it, not browsing. Grouping
 * them means the more serious action (delete) is next to the one
 * people visit more often, so the delete card stays visible instead
 * of hidden under session or theme.
 */
export default function AccountPage() {
  return (
    <SubpageLayout titleKey="account_section" hintKey="me_account_hint">
      <PasswordCard />
      <DeleteAccountCard />
    </SubpageLayout>
  );
}
