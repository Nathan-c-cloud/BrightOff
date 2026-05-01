/* Job & user data */

const JOBS = [
  {
    id: 1, title: "Développeur Fullstack Junior", company: "TechStartup", location: "Paris, Remote",
    score: 85, color: "#7AC7E6", initials: "TS",
    skills: ["React", "Python", "Node.js", "PostgreSQL"],
    type: "CDI", salary: "35-42k€", exp: "0-2 ans", posted: "Il y a 3 jours",
    description: "Rejoins une équipe produit ambitieuse pour développer une plateforme SaaS B2B utilisée par plus de 200 entreprises. Tu travailleras main dans la main avec les designers et le PM sur l'ensemble de la stack — du composant React au schéma PostgreSQL — dans un environnement où chaque ligne de code part en production rapidement.",
    acquired: ["React", "Python", "Git", "Méthodologie Agile", "Anglais B2"],
    mustHave: [{ name: "Node.js", impact: -15 }, { name: "PostgreSQL", impact: -5 }],
    niceHave: [{ name: "Docker", impact: -3 }],
    reco: { from: 85, to: 100, skill: "Node.js", course: "OpenClassrooms — Passez au Full Stack avec Node.js (40h)" }
  },
  {
    id: 2, title: "Ingénieur Logiciel Junior", company: "SaaS Corp", location: "Lyon",
    score: 78, color: "#FF705A", initials: "SC",
    skills: ["Java", "Spring", "REST API", "MySQL"],
    type: "CDI", salary: "38-45k€", exp: "0-2 ans", posted: "Il y a 5 jours",
    description: "Au sein d'une équipe de 12 ingénieurs, tu contribueras à l'évolution de notre plateforme back-end qui traite plus de 10 millions de requêtes par jour. Code review systématique, pair programming hebdomadaire et un focus fort sur la qualité.",
    acquired: ["Java", "Git", "Méthodologie Agile", "Anglais B2"],
    mustHave: [{ name: "Spring Boot", impact: -12 }, { name: "MySQL", impact: -6 }],
    niceHave: [{ name: "Kafka", impact: -4 }],
    reco: { from: 78, to: 96, skill: "Spring Boot", course: "Udemy — Spring & Spring Boot Essentials (32h)" }
  },
  {
    id: 3, title: "Dev Full Stack", company: "FinTech Scale-up", location: "Lyon, Remote",
    score: 72, color: "#ADF7B6", initials: "FT",
    skills: ["Vue.js", "TypeScript", "Go", "Redis"],
    type: "CDI", salary: "40-50k€", exp: "1-3 ans", posted: "Il y a 1 semaine",
    description: "Construit avec nous la prochaine génération d'outils financiers pour PME. Stack moderne, équipe internationale, télétravail flexible. Tu interviendras autant côté front (Vue 3, TS) que sur les microservices Go.",
    acquired: ["TypeScript", "JavaScript", "Git", "Anglais B2"],
    mustHave: [{ name: "Vue.js", impact: -14 }, { name: "Go", impact: -10 }],
    niceHave: [{ name: "Redis", impact: -4 }],
    reco: { from: 72, to: 92, skill: "Vue.js", course: "Vue Mastery — Vue 3 Fundamentals (28h)" }
  },
  {
    id: 4, title: "Développeur Backend Python", company: "DataCompany", location: "Paris",
    score: 68, color: "#FFC2AC", initials: "DC",
    skills: ["Python", "Django", "PostgreSQL", "AWS"],
    type: "CDI", salary: "37-44k€", exp: "0-3 ans", posted: "Il y a 2 jours",
    description: "Plateforme de data analytics traitant la donnée de retailers européens. Tu développeras les pipelines back-end et exposeras les données via une API GraphQL.",
    acquired: ["Python", "Git", "Anglais B2"],
    mustHave: [{ name: "Django", impact: -16 }, { name: "AWS", impact: -10 }],
    niceHave: [{ name: "GraphQL", impact: -6 }],
    reco: { from: 68, to: 90, skill: "Django", course: "OpenClassrooms — Concevez une API REST avec Django (45h)" }
  },
  {
    id: 5, title: "Fullstack Developer", company: "E-commerce", location: "Bordeaux, Remote",
    score: 91, color: "#7AC7E6", initials: "EC",
    skills: ["React", "Node.js", "MongoDB"],
    type: "CDI", salary: "36-42k€", exp: "0-2 ans", posted: "Il y a 1 jour",
    description: "Plateforme e-commerce 100% remote, équipe de 8 développeurs. Stack JavaScript end-to-end, déploiement continu, tests automatisés. Une excellente première expérience après l'école.",
    acquired: ["React", "JavaScript", "Git", "Méthodologie Agile", "Anglais B2"],
    mustHave: [{ name: "Node.js", impact: -7 }],
    niceHave: [{ name: "MongoDB", impact: -2 }],
    reco: { from: 91, to: 100, skill: "Node.js", course: "OpenClassrooms — Passez au Full Stack avec Node.js (40h)" }
  },
  {
    id: 6, title: "Développeur Web Junior", company: "AgenceDev", location: "Nantes",
    score: 65, color: "#E8503A", initials: "AD",
    skills: ["PHP", "Symfony", "MySQL", "jQuery"],
    type: "CDI", salary: "30-35k€", exp: "0-2 ans", posted: "Il y a 4 jours",
    description: "Agence digitale de 25 personnes, projets variés pour des clients PME et grands comptes. Idéal pour découvrir une grande diversité de problématiques web en début de carrière.",
    acquired: ["JavaScript", "Git", "HTML/CSS"],
    mustHave: [{ name: "PHP", impact: -20 }, { name: "Symfony", impact: -12 }],
    niceHave: [{ name: "MySQL", impact: -3 }],
    reco: { from: 65, to: 85, skill: "PHP & Symfony", course: "Symfony Casts — Track Symfony 6 Débutant (50h)" }
  }
];

window.JOBS = JOBS;
