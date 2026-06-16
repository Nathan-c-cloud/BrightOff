"use client";

import React from "react";
import { computeInitials } from "@/lib/profile-utils";

interface ProfileSideProps {
  firstName: string;
  lastName: string;
  email: string;
  onReupload: () => void;
}

/**
 * Aside gauche de la page profil.
 * Affiche l'avatar avec initiales, le nom complet, l'email et le bouton re-upload.
 * Composant pur (pas de state).
 */
export function ProfileSide({
  firstName,
  lastName,
  email,
  onReupload,
}: ProfileSideProps) {
  const initials = computeInitials(firstName, lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <aside className="profile-side">
      <div className="avatar-lg" style={{ margin: "0 auto 14px" }}>
        {initials}
      </div>
      <h2>{fullName}</h2>
      <div className="em">{email}</div>
      <button
        type="button"
        className="btn btn-sky-outline"
        style={{ width: "100%", marginTop: 18 }}
        onClick={onReupload}
      >
        Mettre a jour mon CV
      </button>
    </aside>
  );
}
