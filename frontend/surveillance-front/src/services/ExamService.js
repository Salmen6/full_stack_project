// src/services/ExamService.js
import api from '../api/axios'; // your axios instance

const ExamService = {
  // ---- Backend calls ----
  getAllSeances: () => api.get('/seances'),
  getSeances: () => api.get('/seances'), // alias used by teacher page
  getAllEnseignants: () => api.get('/enseignants'),
  getAllVoeux: () => api.get('/voeux'),
  getEnseignantByUserId: (idUser) => api.get(`/enseignants/by-user/${idUser}`),
  calculateSeanceNeeds: (id) => api.post(`/seances/${id}/calculate-needs`),
  calculateEnseignantLoad: (id) => api.post(`/enseignants/${id}/calculate-load`),
  submitVoeu: (idEnseignant, idSeance) => api.post('/voeux', null, { params: { idEnseignant, idSeance } }),
  assignSurveillant: (idEnseignant, idSeance) => api.post('/affectation', null, { params: { idEnseignant, idSeance } }),
  login: async (loginStr, password) => {
    const res = await api.post('/login', { login: loginStr, password });
    // normalize backend LoginResponse -> frontend user object expected by components
    const data = res.data || {};
    // backend returns idUser, login, role, redirect, enseignant (DTO)
    const user = {
      id_user: data.idUser ?? data.id_user ?? null,
      login: data.login ?? null,
      role: (data.role && data.role.name) ? data.role.name : data.role || null,
      redirect: data.redirect || null,
      enseignantDTO: data.enseignant || null,
      // pick some useful fields for display
      nomComplet: data.enseignant?.nomComplet || null
    };
    return user;
  },

  // ---- Frontend helper checks (mirror backend rules) ----

  /**
   * Returns true if the teacher teaches any matiere included in the given seance.
   * Accepts:
   *  - teacher: either an EnseignantDTO (teacherData from backend) or a full Enseignant (from /enseignants)
   *  - seance: seance object as returned by /seances (with epreuves and matiere info)
   */
  subjectConflict: (teacher, seance) => {
    if (!teacher || !seance) return false;

    // teacher.matieres may be in different shapes. Try to collect IDs or names.
    const teacherMatieres = new Set();
    if (teacher.matieres && Array.isArray(teacher.matieres)) {
      teacher.matieres.forEach(m => {
        if (m.id) teacherMatieres.add(m.id);
        else if (m.nom) teacherMatieres.add(m.nom);
      });
    }
    // Sometimes teacherDTO contains affectations only; if no matieres provided, try enseignantDTO.matieres etc.
    if (teacher.matieres == null && teacher.enseignantDTO && teacher.enseignantDTO.matieres) {
      teacher.enseignantDTO.matieres.forEach(m => teacherMatieres.add(m.id || m.nom));
    }

    // get matieres from seance
    const matieresInSeance = (seance.epreuves || []).map(e => {
      if (e.matiere) return e.matiere.id ?? e.matiere.nom;
      if (e.matiere_nom) return e.matiere_nom;
      if (e.nom) return e.nom;
      return null;
    }).filter(Boolean);

    // If teacher's matieres is empty, we can't detect a conflict on frontend; be conservative: false
    if (teacherMatieres.size === 0) {
      // Not enough data on frontend: assume no conflict (server will enforce)
      return false;
    }

    // check any intersection
    return matieresInSeance.some(m => teacherMatieres.has(m));
  },

  /**
   * Returns true if the teacher already has an assignment at the same date and start time.
   * Expects teacher to include `affectations` or similar with seance (or a list of assigned seances).
   *
   * Rule: conflict if same date (YYYY-MM-DD) AND same heureDebut.
   */
  timeOverlap: (teacher, seance) => {
    if (!teacher || !seance) return false;

    const targetDate = seance.date ?? seance.date_seance ?? seance.dateSeance;
    const targetStart = seance.heureDebut ?? seance.heure_debut ?? seance.start ?? seance.heureDebut;

    if (!targetDate || !targetStart) return false;

    const affectations = teacher.affectations || teacher.affectations || teacher.enseignantDTO?.affectations || [];
    if (!Array.isArray(affectations) || affectations.length === 0) return false;

    return affectations.some(a => {
      const s = a.seance || a;
      const d = s.date ?? s.date_seance ?? s.dateSeance;
      const start = s.heureDebut ?? s.heure_debut ?? s.start;
      return d === targetDate && start === targetStart;
    });
  }
};

export default ExamService;
