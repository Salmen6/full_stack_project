// src/services/ExamService.js
import api from '../api/axios';

const ExamService = {
  // ---- Backend calls ----
  getAllSeances: () => api.get('/seances'),
  getSeances: () => api.get('/seances'),
  getAllEnseignants: () => api.get('/enseignants'),
  getAllVoeux: () => api.get('/voeux'),
  getEnseignantByUserId: (idUser) => api.get(`/enseignants/by-user/${idUser}`),
  calculateSeanceNeeds: (id) => api.post(`/seances/${id}/calculate-needs`),
  calculateEnseignantLoad: (id) => api.post(`/enseignants/${id}/calculate-load`),

  // Updated to handle new response format
  submitVoeu: (idEnseignant, idSeance) =>
    api.post('/voeux', null, { params: { idEnseignant, idSeance } }),

  assignSurveillant: (idEnseignant, idSeance) =>
    api.post('/affectation', null, { params: { idEnseignant, idSeance } }),

  login: async (loginStr, password) => {
    const res = await api.post('/login', { login: loginStr, password });
    const data = res.data || {};
    const user = {
      id_user: data.idUser ?? data.id_user ?? null,
      login: data.login ?? null,
      role: (data.role && data.role.name) ? data.role.name : data.role || null,
      redirect: data.redirect || null,
      enseignantDTO: data.enseignant || null,
      nomComplet: data.enseignant?.nomComplet || null
    };
    return user;
  },

  // ---- Frontend helper checks (mirror backend rules) ----

  /**
   * Returns true if the teacher teaches any matiere included in the given seance.
   * 
   * This function checks for conflicts of interest by comparing:
   * 1. The subjects (matieres) that the teacher teaches
   * 2. The subjects tested in the exam session (from epreuves)
   * 
   * If there's any match, the teacher cannot supervise that session.
   * 
   * @param {Object} teacher - Teacher data object containing matieres
   * @param {Object} seance - Session data object containing epreuves
   * @returns {boolean} - True if teacher teaches any subject in the session
   */
  subjectConflict: (teacher, seance) => {
    if (!teacher || !seance) return false;

    // Build a Set of teacher's subject IDs and names for efficient lookup
    const teacherSubjects = new Set();
    
    // Extract from teacher.matieres (direct field)
    if (teacher.matieres && Array.isArray(teacher.matieres)) {
      teacher.matieres.forEach(m => {
        if (m.id) teacherSubjects.add(`id:${m.id}`);
        if (m.nom) teacherSubjects.add(`nom:${m.nom.toLowerCase()}`);
      });
    }
    
    // Fallback: check enseignantDTO.matieres if available
    if (teacher.matieres == null && teacher.enseignantDTO?.matieres) {
      teacher.enseignantDTO.matieres.forEach(m => {
        if (m.id) teacherSubjects.add(`id:${m.id}`);
        if (m.nom) teacherSubjects.add(`nom:${m.nom.toLowerCase()}`);
      });
    }

    // If teacher has no subjects defined, no conflict
    if (teacherSubjects.size === 0) {
      return false;
    }

    // Extract subjects from session's epreuves
    const epreuves = seance.epreuves || [];
    
    for (const epreuve of epreuves) {
      // Check matiere object
      if (epreuve.matiere) {
        if (epreuve.matiere.id && teacherSubjects.has(`id:${epreuve.matiere.id}`)) {
          return true;
        }
        if (epreuve.matiere.nom && teacherSubjects.has(`nom:${epreuve.matiere.nom.toLowerCase()}`)) {
          return true;
        }
      }
      
      // Fallback: check nom field directly (sometimes used as matiere name)
      if (epreuve.nom && teacherSubjects.has(`nom:${epreuve.nom.toLowerCase()}`)) {
        return true;
      }
      
      // Additional fallback for matiere_nom
      if (epreuve.matiere_nom && teacherSubjects.has(`nom:${epreuve.matiere_nom.toLowerCase()}`)) {
        return true;
      }
    }

    return false;
  },

  /**
   * NEW: Survey Conflict Detection
   * 
   * Returns true if the target session conflicts with any session where the teacher teaches.
   * A conflict exists when:
   * 1. The teacher teaches a subject in a different session
   * 2. That different session occurs at the same date AND time as the target session
   * 3. The teacher cannot survey the target session because they're teaching at that time
   * 
   * Example:
   * - Teacher teaches Math on Monday 10:00-12:00
   * - There's a Physics exam on Monday 10:00-12:00
   * - Teacher cannot survey the Physics exam (conflict)
   * 
   * @param {Object} teacher - Teacher data object containing matieres
   * @param {Object} targetSeance - The session we're checking (the one to potentially survey)
   * @param {Array} allSeances - All available sessions to check for conflicts
   * @returns {boolean} - True if there's a survey conflict
   */
  surveyConflict: (teacher, targetSeance, allSeances) => {
    if (!teacher || !targetSeance || !allSeances || !Array.isArray(allSeances)) {
      return false;
    }

    // Get teacher's subjects
    const teacherSubjects = new Set();
    
    if (teacher.matieres && Array.isArray(teacher.matieres)) {
      teacher.matieres.forEach(m => {
        if (m.id) teacherSubjects.add(`id:${m.id}`);
        if (m.nom) teacherSubjects.add(`nom:${m.nom.toLowerCase()}`);
      });
    }
    
    if (teacher.matieres == null && teacher.enseignantDTO?.matieres) {
      teacher.enseignantDTO.matieres.forEach(m => {
        if (m.id) teacherSubjects.add(`id:${m.id}`);
        if (m.nom) teacherSubjects.add(`nom:${m.nom.toLowerCase()}`);
      });
    }

    // If teacher has no subjects, no conflict possible
    if (teacherSubjects.size === 0) {
      return false;
    }

    // Get target session's date and time
    const targetDate = targetSeance.date ?? targetSeance.date_seance ?? targetSeance.dateSeance;
    const targetStart = targetSeance.heureDebut ?? targetSeance.heure_debut ?? targetSeance.start;
    const targetEnd = targetSeance.heureFin ?? targetSeance.heure_fin ?? targetSeance.end;

    if (!targetDate || !targetStart) {
      return false;
    }

    // Check all sessions for conflicts
    for (const seance of allSeances) {
      // Skip the target session itself
      if (seance.id === targetSeance.id) {
        continue;
      }

      // Check if this session has any subject the teacher teaches
      let teachesThisSession = false;
      const epreuves = seance.epreuves || [];
      
      for (const epreuve of epreuves) {
        if (epreuve.matiere) {
          if (epreuve.matiere.id && teacherSubjects.has(`id:${epreuve.matiere.id}`)) {
            teachesThisSession = true;
            break;
          }
          if (epreuve.matiere.nom && teacherSubjects.has(`nom:${epreuve.matiere.nom.toLowerCase()}`)) {
            teachesThisSession = true;
            break;
          }
        }
        
        if (epreuve.nom && teacherSubjects.has(`nom:${epreuve.nom.toLowerCase()}`)) {
          teachesThisSession = true;
          break;
        }
        
        if (epreuve.matiere_nom && teacherSubjects.has(`nom:${epreuve.matiere_nom.toLowerCase()}`)) {
          teachesThisSession = true;
          break;
        }
      }

      // If teacher teaches this session, check for time conflict
      if (teachesThisSession) {
        const seanceDate = seance.date ?? seance.date_seance ?? seance.dateSeance;
        const seanceStart = seance.heureDebut ?? seance.heure_debut ?? seance.start;
        const seanceEnd = seance.heureFin ?? seance.heure_fin ?? seance.end;

        // Check if dates match
        if (seanceDate === targetDate) {
          // Check for time overlap
          // Sessions conflict if they overlap in time
          if (seanceStart && seanceEnd && targetStart && targetEnd) {
            // Convert time strings to minutes for comparison
            const parseTime = (timeStr) => {
              if (!timeStr) return 0;
              const parts = timeStr.split(':');
              return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
            };

            const seanceStartMin = parseTime(seanceStart);
            const seanceEndMin = parseTime(seanceEnd);
            const targetStartMin = parseTime(targetStart);
            const targetEndMin = parseTime(targetEnd);

            // Check for overlap: sessions overlap if one starts before the other ends
            const hasOverlap = (
              (targetStartMin >= seanceStartMin && targetStartMin < seanceEndMin) || // Target starts during seance
              (targetEndMin > seanceStartMin && targetEndMin <= seanceEndMin) || // Target ends during seance
              (targetStartMin <= seanceStartMin && targetEndMin >= seanceEndMin) || // Target encompasses seance
              (seanceStartMin <= targetStartMin && seanceEndMin >= targetEndMin) // Seance encompasses target
            );

            if (hasOverlap) {
              return true; // Conflict found
            }
          }
          // Fallback: if we can't parse times, just check if start times match
          else if (seanceStart === targetStart) {
            return true;
          }
        }
      }
    }

    return false; // No conflict found
  },

  /**
   * Returns true if the teacher already has an assignment at the same date and start time.
   * 
   * Teachers cannot be assigned to multiple sessions at the same time slot.
   * 
   * @param {Object} teacher - Teacher data with affectations
   * @param {Object} seance - Target session to check
   * @returns {boolean} - True if there's a time conflict
   */
  timeOverlap: (teacher, seance) => {
    if (!teacher || !seance) return false;

    // Extract target session's date and time
    const targetDate = seance.date ?? seance.date_seance ?? seance.dateSeance;
    const targetStart = seance.heureDebut ?? seance.heure_debut ?? seance.start;

    if (!targetDate || !targetStart) return false;

    // Get teacher's existing affectations
    const affectations = teacher.affectations || teacher.enseignantDTO?.affectations || [];
    if (!Array.isArray(affectations) || affectations.length === 0) return false;

    // Check each affectation for time overlap
    return affectations.some(a => {
      const s = a.seance || a;
      const affDate = s.date ?? s.date_seance ?? s.dateSeance;
      const affStart = s.heureDebut ?? s.heure_debut ?? s.start;
      
      // Time overlap exists if date and start time match
      return affDate === targetDate && affStart === targetStart;
    });
  }
};

export default ExamService;