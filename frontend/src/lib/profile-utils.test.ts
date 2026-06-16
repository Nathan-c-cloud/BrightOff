/**
 * Tests unitaires — profile-utils.ts
 *
 * Couvre :
 *   - computeInitials : cas nominaux, prenom vide, nom vide, les deux vides
 *   - splitSkillsBySection : separation hard/soft, categories inconnues, tableau vide
 *   - formatRange : plage standard, end_date null
 *   - formatDuration : 1 an, plusieurs annees, mois seuls, combinaison, moins d'un mois, end null
 *   - categoryForSection : mapping hard -> technique, soft -> soft_skill
 *   - toUpdatePayload : payload sans ids
 */

import { describe, it, expect } from "vitest";
import {
  computeInitials,
  splitSkillsBySection,
  formatRange,
  formatDuration,
  categoryForSection,
  toUpdatePayload,
} from "./profile-utils";
import type { Skill, ProfileData } from "./api-profile";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeSkill(
  id: string,
  name: string,
  category: "technique" | "outil" | "soft_skill"
): Skill {
  return { id, name, category, level: null };
}

function makeProfileData(): ProfileData {
  return {
    id: "profile-1",
    title: "Developpeur Fullstack",
    summary: "Passionné par le code.",
    skills: [
      { id: "s1", name: "React", category: "technique", level: null },
      { id: "s2", name: "VS Code", category: "outil", level: null },
      { id: "s3", name: "Travail en equipe", category: "soft_skill", level: null },
    ],
    experiences: [
      {
        id: "e1",
        company: "Acme Corp",
        position: "Dev Fullstack",
        start_date: "2022-01-01",
        end_date: "2024-06-01",
        description: "Missions diverses",
      },
    ],
    educations: [
      {
        id: "ed1",
        school: "ESIGELEC",
        degree: "Ingenieur",
        field: "Informatique",
        start_date: "2019-09-01",
        end_date: "2022-06-30",
      },
    ],
    languages: [
      { id: "l1", name: "Anglais", level: "B2" },
    ],
    updated_at: "2024-06-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// computeInitials
// ---------------------------------------------------------------------------

describe("computeInitials", () => {
  it("returns_two_uppercase_initials_when_both_names_filled", () => {
    expect(computeInitials("Alice", "Martin")).toBe("AM");
  });

  it("returns_uppercase_initials_from_lowercased_input", () => {
    expect(computeInitials("alice", "martin")).toBe("AM");
  });

  it("returns_two_chars_from_first_name_when_last_name_empty", () => {
    expect(computeInitials("Alice", "")).toBe("AL");
  });

  it("returns_two_chars_from_last_name_when_first_name_empty", () => {
    expect(computeInitials("", "Martin")).toBe("MA");
  });

  it("returns_one_char_from_last_name_when_last_name_is_single_char", () => {
    expect(computeInitials("", "X")).toBe("X");
  });

  it("returns_question_mark_when_both_names_empty", () => {
    expect(computeInitials("", "")).toBe("?");
  });

  it("trims_whitespace_before_computing", () => {
    expect(computeInitials("  Alice  ", "  Martin  ")).toBe("AM");
  });

  it("returns_question_mark_when_both_names_are_whitespace", () => {
    expect(computeInitials("   ", "   ")).toBe("?");
  });
});

// ---------------------------------------------------------------------------
// splitSkillsBySection
// ---------------------------------------------------------------------------

describe("splitSkillsBySection", () => {
  it("returns_empty_arrays_when_skills_list_is_empty", () => {
    const result = splitSkillsBySection([]);
    expect(result).toEqual({ hard: [], soft: [] });
  });

  it("places_technique_skills_into_hard_bucket", () => {
    const skills = [makeSkill("s1", "React", "technique")];
    const result = splitSkillsBySection(skills);
    expect(result.hard).toHaveLength(1);
    expect(result.hard[0].name).toBe("React");
    expect(result.soft).toHaveLength(0);
  });

  it("places_outil_skills_into_hard_bucket", () => {
    const skills = [makeSkill("s2", "VS Code", "outil")];
    const result = splitSkillsBySection(skills);
    expect(result.hard).toHaveLength(1);
    expect(result.hard[0].name).toBe("VS Code");
    expect(result.soft).toHaveLength(0);
  });

  it("places_soft_skill_into_soft_bucket", () => {
    const skills = [makeSkill("s3", "Leadership", "soft_skill")];
    const result = splitSkillsBySection(skills);
    expect(result.soft).toHaveLength(1);
    expect(result.soft[0].name).toBe("Leadership");
    expect(result.hard).toHaveLength(0);
  });

  it("correctly_splits_mixed_skills_into_both_buckets", () => {
    const skills = [
      makeSkill("s1", "TypeScript", "technique"),
      makeSkill("s2", "Figma", "outil"),
      makeSkill("s3", "Communication", "soft_skill"),
    ];
    const result = splitSkillsBySection(skills);
    expect(result.hard).toHaveLength(2);
    expect(result.soft).toHaveLength(1);
  });

  it("ignores_skills_with_unknown_category_they_do_not_appear_in_either_bucket", () => {
    // Test de non-regression : une categorie inconnue ne doit pas apparaitre
    const skillsWithUnknown = [
      { id: "s1", name: "Mystere", category: "unknown" as "technique", level: null },
    ];
    const result = splitSkillsBySection(skillsWithUnknown);
    expect(result.hard).toHaveLength(0);
    expect(result.soft).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatRange
// ---------------------------------------------------------------------------

describe("formatRange", () => {
  it("formats_a_standard_date_range_in_french", () => {
    // jan. 2022 — juin 2024
    expect(formatRange("2022-01-01", "2024-06-30")).toBe("jan. 2022 — juin 2024");
  });

  it("formats_start_only_with_en_cours_when_end_is_null", () => {
    expect(formatRange("2022-01-01", null)).toBe("jan. 2022 — en cours");
  });

  it("formats_month_abbreviations_correctly_for_all_months", () => {
    expect(formatRange("2024-02-01", "2024-12-01")).toBe("fév. 2024 — déc. 2024");
  });

  it("handles_march_with_no_dot_abbreviation", () => {
    expect(formatRange("2023-03-15", "2023-08-15")).toBe("mars 2023 — août 2023");
  });

  it("handles_same_start_and_end_month", () => {
    expect(formatRange("2023-06-01", "2023-06-30")).toBe("juin 2023 — juin 2023");
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("returns_en_cours_when_end_date_is_null", () => {
    expect(formatDuration("2022-01-01", null)).toBe("en cours");
  });

  it("returns_1_an_for_exactly_one_year", () => {
    expect(formatDuration("2022-01-01", "2023-01-01")).toBe("1 an");
  });

  it("returns_plural_ans_for_two_years_zero_months", () => {
    expect(formatDuration("2022-01-01", "2024-01-01")).toBe("2 ans");
  });

  it("returns_months_only_when_under_one_year", () => {
    // jan. 2022 -> août 2022 = 7 mois
    expect(formatDuration("2022-01-01", "2022-08-01")).toBe("7 mois");
  });

  it("returns_years_and_months_combined", () => {
    // jan. 2022 -> juin 2024 = 2 ans 5 mois
    expect(formatDuration("2022-01-01", "2024-06-01")).toBe("2 ans 5 mois");
  });

  it("returns_moins_d_un_mois_when_duration_is_less_than_one_month", () => {
    expect(formatDuration("2022-01-01", "2022-01-15")).toBe("moins d'un mois");
  });

  it("returns_moins_d_un_mois_when_start_equals_end", () => {
    expect(formatDuration("2022-06-01", "2022-06-01")).toBe("moins d'un mois");
  });

  it("accounts_for_day_adjustment_when_end_day_is_before_start_day", () => {
    // 2022-01-31 -> 2022-02-28 : le jour 28 < 31 => ajustement => 0 mois => moins d'un mois
    expect(formatDuration("2022-01-31", "2022-02-28")).toBe("moins d'un mois");
  });

  it("returns_8_mois_for_standard_8_month_range", () => {
    // 2024-01-01 -> 2024-09-01 = 8 mois
    expect(formatDuration("2024-01-01", "2024-09-01")).toBe("8 mois");
  });
});

// ---------------------------------------------------------------------------
// categoryForSection
// ---------------------------------------------------------------------------

describe("categoryForSection", () => {
  it("returns_technique_for_hard_section", () => {
    expect(categoryForSection("hard")).toBe("technique");
  });

  it("returns_soft_skill_for_soft_section", () => {
    expect(categoryForSection("soft")).toBe("soft_skill");
  });
});

// ---------------------------------------------------------------------------
// toUpdatePayload
// ---------------------------------------------------------------------------

describe("toUpdatePayload", () => {
  it("returns_payload_without_ids_on_skills", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    payload.skills.forEach((s) => {
      expect(s).not.toHaveProperty("id");
    });
  });

  it("returns_payload_without_ids_on_experiences", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    payload.experiences.forEach((e) => {
      expect(e).not.toHaveProperty("id");
    });
  });

  it("returns_payload_without_ids_on_educations", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    payload.educations.forEach((ed) => {
      expect(ed).not.toHaveProperty("id");
    });
  });

  it("returns_payload_without_ids_on_languages", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    payload.languages.forEach((l) => {
      expect(l).not.toHaveProperty("id");
    });
  });

  it("preserves_top_level_scalar_fields", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    expect(payload.title).toBe(data.title);
    expect(payload.summary).toBe(data.summary);
  });

  it("preserves_all_collection_items_count", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    expect(payload.skills).toHaveLength(data.skills.length);
    expect(payload.experiences).toHaveLength(data.experiences.length);
    expect(payload.educations).toHaveLength(data.educations.length);
    expect(payload.languages).toHaveLength(data.languages.length);
  });

  it("preserves_skill_fields_name_category_level", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    expect(payload.skills[0]).toEqual({ name: "React", category: "technique", level: null });
  });

  it("preserves_experience_fields", () => {
    const data = makeProfileData();
    const payload = toUpdatePayload(data);
    expect(payload.experiences[0]).toEqual({
      company: "Acme Corp",
      position: "Dev Fullstack",
      start_date: "2022-01-01",
      end_date: "2024-06-01",
      description: "Missions diverses",
    });
  });

  it("handles_null_title_and_summary", () => {
    const data = { ...makeProfileData(), title: null, summary: null };
    const payload = toUpdatePayload(data);
    expect(payload.title).toBeNull();
    expect(payload.summary).toBeNull();
  });

  it("handles_empty_collections", () => {
    const data = {
      ...makeProfileData(),
      skills: [],
      experiences: [],
      educations: [],
      languages: [],
    };
    const payload = toUpdatePayload(data);
    expect(payload.skills).toEqual([]);
    expect(payload.experiences).toEqual([]);
    expect(payload.educations).toEqual([]);
    expect(payload.languages).toEqual([]);
  });
});
