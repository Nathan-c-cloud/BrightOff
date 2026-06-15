/**
 * Tests unitaires — ProfileSkillsSection
 *
 * Couvre :
 *   - Rendu avec liste vide
 *   - Rendu avec skills existantes
 *   - Ajout d'une skill via le formulaire draft
 *   - Suppression d'une skill
 *   - Édition inline du nom d'une skill
 *   - Annulation du formulaire d'ajout
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { ProfileSkillsSection } from "./ProfileSkillsSection";
import type { LocalSkill } from "./ProfileSkillsSection";

// Wrapper stateful nécessaire pour les tests qui simulent plusieurs frappes :
// ProfileSkillsSection est un composant controlled — sans remontée d'état réelle,
// la prop `value` ne change pas entre deux frappes et le DOM revient à la valeur
// initiale après chaque re-render.
function StatefulWrapper({
  initialValue,
  onChangeSpy,
}: {
  initialValue: LocalSkill[];
  onChangeSpy: ReturnType<typeof vi.fn>;
}) {
  const [skills, setSkills] = useState<LocalSkill[]>(initialValue);
  return (
    <ProfileSkillsSection
      value={skills}
      onChange={(next) => {
        setSkills(next);
        onChangeSpy(next);
      }}
    />
  );
}

function makeSkill(overrides: Partial<LocalSkill> = {}): LocalSkill {
  return {
    _localId: `test-${Math.random().toString(36).slice(2)}`,
    name: "Python",
    category: "tech",
    level: 4,
    ...overrides,
  };
}

describe("ProfileSkillsSection — rendu liste vide", () => {
  it("affiche_message_vide_quand_aucune_skill", () => {
    render(<ProfileSkillsSection value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/aucune compétence/i)).toBeInTheDocument();
  });

  it("affiche_bouton_ajouter", () => {
    render(<ProfileSkillsSection value={[]} onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /ajouter/i })
    ).toBeInTheDocument();
  });
});

describe("ProfileSkillsSection — rendu avec skills", () => {
  it("affiche_les_noms_des_skills", () => {
    const skills = [
      makeSkill({ name: "React", _localId: "1" }),
      makeSkill({ name: "TypeScript", _localId: "2" }),
    ];
    render(<ProfileSkillsSection value={skills} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("React")).toBeInTheDocument();
    expect(screen.getByDisplayValue("TypeScript")).toBeInTheDocument();
  });

  it("affiche_bouton_supprimer_pour_chaque_skill", () => {
    const skills = [
      makeSkill({ name: "React", _localId: "1" }),
      makeSkill({ name: "Vue", _localId: "2" }),
    ];
    render(<ProfileSkillsSection value={skills} onChange={vi.fn()} />);
    const deleteButtons = screen.getAllByRole("button", {
      name: /supprimer la compétence/i,
    });
    expect(deleteButtons).toHaveLength(2);
  });
});

describe("ProfileSkillsSection — ajout d'une skill", () => {
  it("ouvre_le_formulaire_draft_au_clic_sur_ajouter", async () => {
    render(<ProfileSkillsSection value={[]} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /ajouter/i }));

    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ajouter$/i })).toBeInTheDocument();
  });

  it("appelle_onChange_avec_la_nouvelle_skill_au_commit", async () => {
    const onChange = vi.fn();
    render(<StatefulWrapper initialValue={[]} onChangeSpy={onChange} />);

    // Ouvrir le formulaire
    await userEvent.click(screen.getByRole("button", { name: /\+ ajouter/i }));

    // Saisir le nom
    const nameInput = screen.getByPlaceholderText(/ex : react/i);
    await userEvent.type(nameInput, "Terraform");

    // Valider
    await userEvent.click(screen.getByRole("button", { name: /^ajouter$/i }));

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as [LocalSkill[]];
    const newList = lastCall[0];
    expect(newList).toHaveLength(1);
    expect(newList[0].name).toBe("Terraform");
    expect(newList[0].category).toBe("tech");
  });

  it("ne_soumet_pas_si_nom_vide", async () => {
    const onChange = vi.fn();
    render(<ProfileSkillsSection value={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /\+ ajouter/i }));

    // Bouton "Ajouter" doit être désactivé quand le nom est vide
    const addButton = screen.getByRole("button", { name: /^ajouter$/i });
    expect(addButton).toBeDisabled();
  });

  it("ferme_le_formulaire_apres_annulation", async () => {
    render(<ProfileSkillsSection value={[]} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    await userEvent.click(screen.getByRole("button", { name: /annuler/i }));

    expect(
      screen.queryByRole("button", { name: /^ajouter$/i })
    ).not.toBeInTheDocument();
  });
});

describe("ProfileSkillsSection — suppression d'une skill", () => {
  it("appelle_onChange_sans_la_skill_supprimee", async () => {
    const skill1 = makeSkill({ name: "React", _localId: "sk-1" });
    const skill2 = makeSkill({ name: "Vue", _localId: "sk-2" });
    const onChange = vi.fn();

    render(
      <ProfileSkillsSection value={[skill1, skill2]} onChange={onChange} />
    );

    const deleteButtons = screen.getAllByRole("button", {
      name: /supprimer la compétence/i,
    });
    // Cliquer sur le bouton de suppression de la première skill
    await userEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledOnce();
    const [newList] = onChange.mock.calls[0] as [LocalSkill[]];
    expect(newList).toHaveLength(1);
    expect(newList[0]._localId).toBe("sk-2");
  });
});

describe("ProfileSkillsSection — édition inline", () => {
  it("appelle_onChange_avec_le_nouveau_nom_apres_edition", async () => {
    const skill = makeSkill({ name: "Python", _localId: "sk-edit" });
    const onChange = vi.fn();

    // Wrapper stateful requis : composant controlled, sans remontée d'état réelle
    // la prop value ne changerait pas entre deux frappes et "Django" ne s'accumulerait pas
    render(
      <StatefulWrapper initialValue={[skill]} onChangeSpy={onChange} />
    );

    const nameInput = screen.getByDisplayValue("Python");
    // Effacer et retaper
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Django");

    // onChange appelé à chaque frappe — vérifier le dernier appel
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as [
      LocalSkill[]
    ];
    expect(lastCall[0][0].name).toBe("Django");
  });
});
