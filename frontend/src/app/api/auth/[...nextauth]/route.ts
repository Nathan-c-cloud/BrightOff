/**
 * Handler Auth.js v5 pour le App Router Next.js.
 *
 * Ce fichier délègue entièrement à l'instance Auth.js configurée dans
 * src/auth.ts. Il expose les méthodes HTTP GET et POST nécessaires au
 * fonctionnement d'Auth.js :
 *   - GET  /api/auth/session
 *   - GET  /api/auth/csrf
 *   - GET  /api/auth/providers
 *   - GET  /api/auth/callback/[provider]
 *   - POST /api/auth/signin/[provider]
 *   - POST /api/auth/signout
 *
 * Ne rien ajouter ici — toute la logique est dans src/auth.ts.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
