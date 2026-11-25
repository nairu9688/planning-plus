// Données d'exemple au format de GET /api/v1/widget, calquées sur la vraie semaine du 23/11/2026.
// « Maintenant » = mercredi 25 novembre 2026, 10h36 (heure de Paris).
(function () {
  const NOW = Date.parse("2026-11-25T09:36:00Z");
  const C = { maths: "#D50000", eco: "#F6BF26", droit: "#3F51B5", management: "#B0369B", anglais: "#039BE5", espagnol: "#F4511E", lettres: "#33B679", philo: "#00897B" };
  const N = { maths: "Mathématiques", eco: "Économie", droit: "Droit", management: "Management", anglais: "Anglais", espagnol: "Espagnol", lettres: "Lettres", philo: "Philosophie" };
  const iso = (day, hm) => new Date(`${day}T${hm}:00+01:00`).toISOString();
  const min = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
  const lab = (hm) => hm.replace(":", "h");
  let id = 0;
  const ev = (day, a, b, title, short, key, kind = "cours", location = "Salle 113") => ({
    id: `e${++id}`, title, short, kind, start: iso(day, a), end: iso(day, b), startLabel: lab(a), endLabel: lab(b), startMin: min(a), endMin: min(b),
    color: key ? C[key] : null, subject: key ? N[key] : null, location,
  });
  const ses = (day, a, b, kind = "etude") => ({ id: `s${++id}`, kind, status: "prevue", start: iso(day, a), end: iso(day, b), startLabel: lab(a), endLabel: lab(b), startMin: min(a), endMin: min(b), colors: [C.droit, C.maths] });

  const days = [
    { date: "2026-11-25", label: "Aujourd'hui", short: "mer. 25", events: [
      ev("2026-11-25", "08:00", "09:50", "Management Gest. Entreprise (Jacques)", "Management", "management"),
      ev("2026-11-25", "10:05", "11:55", "Maths Informatique (Le Mintier)", "Maths Info", "maths"),
      ev("2026-11-25", "13:00", "14:50", "Anglais LV1 (Defrance)", "Anglais LV1", "anglais"),
      ev("2026-11-25", "15:05", "16:55", "Lettres & Philosophie (Cervellon)", "Lettres & Philo", "philo"),
      ev("2026-11-25", "17:30", "18:30", "Khôlle Gestion (Roudière)", "Khôlle Gestion", "management", "kholle", "Salle 464"),
    ], sessions: [ses("2026-11-25", "20:00", "21:50")] },
    { date: "2026-11-26", label: "Demain", short: "jeu. 26", events: [
      ev("2026-11-26", "08:00", "09:50", "Maths Informatique (Le Mintier)", "Maths Info", "maths"),
      ev("2026-11-26", "10:05", "11:25", "Espagnol LV2 (Mayoral)", "Espagnol LV2", "espagnol"),
      ev("2026-11-26", "13:00", "13:55", "Lettres & Philosophie (Cervellon)", "Lettres & Philo", "philo"),
      ev("2026-11-26", "13:55", "14:50", "Economie (Jacquier)", "Economie", "eco"),
      ev("2026-11-26", "15:05", "16:55", "Management Gest. Entreprise (Jacques)", "Management", "management"),
      ev("2026-11-26", "17:10", "18:30", "Khôlle Économie (Singer)", "Khôlle Économie", "eco", "kholle", "Salle 444"),
    ], sessions: [ses("2026-11-26", "20:00", "21:50")] },
    { date: "2026-11-27", label: "Vendredi 27", short: "ven. 27", events: [
      ev("2026-11-27", "08:00", "09:25", "Droit (Huguet)", "Droit", "droit"),
      ev("2026-11-27", "09:40", "11:00", "Anglais LV1 (Defrance)", "Anglais LV1", "anglais"),
      ev("2026-11-27", "11:00", "12:20", "Espagnol LV2 (Mayoral)", "Espagnol LV2", "espagnol"),
      ev("2026-11-27", "13:25", "15:15", "Economie (Jacquier)", "Economie", "eco"),
      ev("2026-11-27", "15:30", "17:20", "Maths Informatique (Le Mintier)", "Maths Info", "maths"),
    ], sessions: [ses("2026-11-27", "21:00", "23:00", "maison")] },
    { date: "2026-11-28", label: "Samedi 28", short: "sam. 28", events: [
      ev("2026-11-28", "08:00", "09:50", "Management Gest. Entreprise (Jacques) - semaine A", "Management", "management"),
      ev("2026-11-28", "10:05", "11:55", "Lettres & Philosophie (Gay) - semaine A", "Lettres & Philo", "lettres"),
    ], sessions: [] },
    { date: "2026-11-29", label: "Dimanche 29", short: "dim. 29", events: [], sessions: [ses("2026-11-29", "10:00", "19:00", "bibliotheque")] },
  ];

  const exam = (o) => ({ prepTasksOpen: 1, ...o });
  window.SAMPLE_WIDGET_DATA = {
    now: NOW,
    data: {
      generatedAt: new Date(NOW).toISOString(),
      focus: { running: false },
      today: "2026-11-25",
      todayLabel: "Mercredi 25",
      week: "A",
      streak: 5,
      current: { ...days[0].events[1], type: "event" },
      next: { ...days[0].events[2], type: "event" },
      days,
      tonight: {
        id: "s-tonight", mode: "etude", status: "prevue", startLabel: "20h00", endLabel: "21h50", ended: false, plannedMinutes: 95, slotMinutes: 110,
        items: [
          { id: "i1", label: "Fiche arrêt Blanco", subject: "Droit", color: C.droit, minutes: 35, done: false },
          { id: "i2", label: "Exos 12 à 15 p. 84", subject: "Mathématiques", color: C.maths, minutes: 35, done: false },
          { id: "i3", label: "Prépa khôlle Gestion", subject: "Management", color: C.management, minutes: 25, done: true },
        ],
      },
      ds: [
        exam({ id: "d1", title: "DS - Philosophie N°2 (anticipée du CB)", short: "DS Philo N°2", subject: "Philosophie", color: C.philo, start: iso("2026-11-30", "08:00"), dayLabel: "Lundi 30", time: "08h00", daysLeft: 5, countdown: { evenings: 3, weekends: 1, holidayDays: 0 }, countdownText: "3 soirs · 1 WE", gauge: 0.45, worked7dMinutes: 95, location: "Salle 113" }),
        exam({ id: "d2", title: "Synthèse N°2", short: "Synthèse N°2", subject: "Droit", color: C.droit, start: iso("2026-12-07", "08:00"), dayLabel: "Lundi 7", time: "08h00", daysLeft: 12, countdown: { evenings: 8, weekends: 2, holidayDays: 0 }, countdownText: "8 soirs · 2 WE", gauge: 0.2, worked7dMinutes: 30, location: "Salle 113" }),
        exam({ id: "d3", title: "Etude de cas ECT1 N°3", short: "Etude de cas N°3", subject: "Management", color: C.management, start: iso("2026-12-07", "13:15"), dayLabel: "Lundi 7", time: "13h15", daysLeft: 12, countdown: { evenings: 8, weekends: 2, holidayDays: 0 }, countdownText: "8 soirs · 2 WE", gauge: null, worked7dMinutes: 0, location: "Salle 113" }),
        exam({ id: "d4", title: "DS - ESH HGG ECO N°3", short: "DS ESH HGG ECO N°3", subject: "Économie", color: C.eco, start: iso("2026-12-14", "08:00"), dayLabel: "Lundi 14", time: "08h00", daysLeft: 19, countdown: { evenings: 13, weekends: 3, holidayDays: 0 }, countdownText: "13 soirs · 3 WE", gauge: 0.1, worked7dMinutes: 0, location: "Salle 113" }),
        exam({ id: "d5", title: "DS - Mathématiques N°4", short: "DS Maths N°4", subject: "Mathématiques", color: C.maths, start: iso("2026-12-15", "08:00"), dayLabel: "Mardi 15", time: "08h00", daysLeft: 20, countdown: { evenings: 14, weekends: 3, holidayDays: 0 }, countdownText: "14 soirs · 3 WE", gauge: 0.66, worked7dMinutes: 120, location: "Salle 113" }),
      ],
      kholles: [
        { ...exam({ id: "k1", title: "Khôlle Gestion (Roudière)", short: "Khôlle Gestion", subject: "Management", color: C.management, start: iso("2026-11-25", "17:30"), dayLabel: "Aujourd'hui", time: "17h30", daysLeft: 0, countdown: { evenings: 0, weekends: 0, holidayDays: 0 }, countdownText: "0 soir · 0 WE", gauge: null, worked7dMinutes: 40, location: "Salle 464" }), teacher: "Roudière", info: "Pas de préparation — Début de la khôlle : 17h30 — Fin : 18h30 (semaine S7)", prep: null, questions: 4, questionsToReview: 2 },
        { ...exam({ id: "k2", title: "Khôlle Économie (Singer)", short: "Khôlle Économie", subject: "Économie", color: C.eco, start: iso("2026-11-26", "17:10"), dayLabel: "Demain", time: "17h10", daysLeft: 1, countdown: { evenings: 1, weekends: 0, holidayDays: 0 }, countdownText: "1 soir · 0 WE", gauge: null, worked7dMinutes: 0, location: "Salle 444" }), teacher: "Singer", info: "Préparation : 17h10 — Début de la khôlle : 17h30 — Fin : 18h30 (semaine S7)", prep: "17h10", questions: 0, questionsToReview: 0 },
        { ...exam({ id: "k3", title: "Khôlle Anglais (Defrance)", short: "Khôlle Anglais", subject: "Anglais", color: C.anglais, start: iso("2026-11-30", "16:15"), dayLabel: "Lundi 30", time: "16h15", daysLeft: 5, countdown: { evenings: 3, weekends: 1, holidayDays: 0 }, countdownText: "3 soirs · 1 WE", gauge: null, worked7dMinutes: 0, location: null }), teacher: "Defrance", info: null, prep: null, questions: 0, questionsToReview: 0 },
        { ...exam({ id: "k4", title: "Khôlle Anglais (Deville)", short: "Khôlle Anglais", subject: "Anglais", color: C.anglais, start: iso("2026-12-02", "18:10"), dayLabel: "Mercredi 2", time: "18h10", daysLeft: 7, countdown: { evenings: 4, weekends: 1, holidayDays: 0 }, countdownText: "4 soirs · 1 WE", gauge: null, worked7dMinutes: 0, location: "Salle 455" }), teacher: "Deville", info: "Préparation : 18h10 — Début de la khôlle : 18h30", prep: "18h10", questions: 0, questionsToReview: 0 },
      ],
      cb: { id: "cb1", name: "CB décembre", exams: 6, first: iso("2026-12-14", "08:00"), daysLeft: 19, countdownText: "13 soirs · 3 WE" },
      homework: [
        { id: "h1", title: "Fiche arrêt Blanco", subject: "Droit", color: C.droit, due: iso("2026-11-24", "08:00"), dueLabel: "en retard (1 j)", overdue: true, dueToday: false, priority: "haute", status: "a_faire", estimatedMinutes: 30 },
        { id: "h2", title: "Exos 12 à 15 p. 84", subject: "Mathématiques", color: C.maths, due: iso("2026-11-26", "08:00"), dueLabel: "demain", overdue: false, dueToday: false, priority: "normale", status: "en_cours", estimatedMinutes: 45 },
        { id: "h3", title: "Essay draft — technology and society", subject: "Anglais", color: C.anglais, due: iso("2026-11-27", "08:00"), dueLabel: "ven. 27", overdue: false, dueToday: false, priority: "normale", status: "a_faire", estimatedMinutes: 60 },
        { id: "h4", title: "Lire le chapitre 4", subject: "Économie", color: C.eco, due: iso("2026-11-30", "08:00"), dueLabel: "lun. 30", overdue: false, dueToday: false, priority: "basse", status: "a_faire", estimatedMinutes: 30 },
        { id: "h5", title: "Exposé marketing", subject: "Management", color: C.management, due: iso("2026-12-03", "08:00"), dueLabel: "03/12", overdue: false, dueToday: false, priority: "normale", status: "a_faire", estimatedMinutes: 90 },
      ],
      homeworkCounts: { open: 5, overdue: 1, today: 0, week: 3 },
      weekWork: {
        realMinutes: 230, plannedMinutes: 560, weekElapsed: 0.32,
        byDay: [["L", 110], ["M", 120], ["M", 0], ["J", 0], ["V", 0], ["S", 0], ["D", 0]].map(([s, m], i) => ({ date: `2026-11-2${3 + i}`, short: s, minutes: m, isToday: i === 2 })),
        bySubject: [
          { name: "Mathématiques", color: C.maths, minutes: 90, goal: 300 },
          { name: "Droit", color: C.droit, minutes: 70, goal: 240 },
          { name: "Management", color: C.management, minutes: 40, goal: 180 },
          { name: "Anglais", color: C.anglais, minutes: 30, goal: 0 },
        ],
        goals: [
          { name: "Mathématiques", color: C.maths, goal: 300, minutes: 90 },
          { name: "Droit", color: C.droit, goal: 240, minutes: 70 },
          { name: "Management", color: C.management, goal: 180, minutes: 40 },
        ],
      },
      neglected: [{ name: "Espagnol", color: C.espagnol, days: 9 }, { name: "Lettres", color: C.lettres, days: null }],
      notes: [
        { id: "n1", content: "Imprimer le TD de droit", color: "yellow", pinned: true },
        { id: "n2", content: "Rendre le livre au CDI avant vendredi", color: "blue", pinned: false },
        { id: "n3", content: "Demander le corrigé du DS 3", color: "green", pinned: false },
      ],
      subjects: Object.keys(C).map((k) => ({ key: k, name: N[k], color: C[k] })),
    },
  };
})();
