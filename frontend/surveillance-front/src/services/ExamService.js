// src/services/ExamService.js
import api from '../api/axios';

const ExamService = {
  // ---- Backend calls ----
  
  /**
   * Get seances with optional query parameters
   * Supports pagination and filtering
   * @param {Object} params - Optional query parameters (e.g., { all: true, page: 0, size: 100 })
   * @returns {Promise} - Axios response with seances data
   */
  getSeances: (params = {}) => {
    // If 'all' flag is set, use a very large size to attempt fetching all records
    if (params.all === true) {
      return api.get('/seances', { params: { size: 10000 } });
    }
    return api.get('/seances', { params });
  },

  /**
   * Get ALL seances without pagination
   * Internally calls getSeances with all flag
   * @returns {Promise} - Axios response with all seances
   */
  getAllSeances: () => {
    return ExamService.getSeances({ all: true });
  },

  getAllEnseignants: () => api.get('/enseignants'),
  getAllVoeux: () => api.get('/voeux'),
  getEnseignantByUserId: (idUser) => api.get(`/enseignants/by-user/${idUser}`),
  calculateSeanceNeeds: (id) => api.post(`/seances/${id}/calculate-needs`),
  calculateEnseignantLoad: (id) => api.post(`/enseignants/${id}/calculate-load`),

  // Updated to handle new response format
  submitVoeu: (idEnseignant, idSeance) =>
    api.post('/voeux', null, { params: { idEnseignant, idSeance } }),

  /**
   * NEW: Cancel a teacher's wish and remove the associated assignment.
   * 
   * This endpoint:
   * 1. Deletes the Voeu (wish) record from the database
   * 2. Deletes the corresponding Affectation (assignment)
   * 3. Decrements the nbSurveillantsInscrits counter on the Seance
   * 
   * @param {number} idEnseignant - The teacher's ID
   * @param {number} idSeance - The session ID
   * @returns {Promise} - Axios response with success/failure message
   */
  cancelVoeu: (idEnseignant, idSeance) =>
    api.delete('/voeux', { params: { idEnseignant, idSeance } }),

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

  /**
   * Fetch all seances with automatic pagination handling
   * Attempts multiple strategies to get complete dataset:
   * 1. Request with large size parameter
   * 2. Check if response is paginated and fetch remaining pages
   * 3. Fallback to multiple requests if needed
   * 
   * @returns {Promise<Array>} - Complete array of all seances
   */
  fetchAllSeances: async () => {
    try {
      // Strategy 1: Try to get all with large size parameter
      const response = await api.get('/seances', { params: { size: 10000 } });
      
      // Check if response is paginated (Spring Boot Page format)
      if (response.data && typeof response.data === 'object' && 'content' in response.data) {
        // Paginated response
        let allSeances = [...response.data.content];
        const totalPages = response.data.totalPages || 1;
        const currentPage = response.data.number || 0;
        
        // If there are more pages, fetch them
        if (totalPages > 1) {
          const pagePromises = [];
          for (let page = currentPage + 1; page < totalPages; page++) {
            pagePromises.push(
              api.get('/seances', { params: { page, size: response.data.size || 20 } })
            );
          }
          
          const remainingPages = await Promise.all(pagePromises);
          remainingPages.forEach(pageResponse => {
            if (pageResponse.data && pageResponse.data.content) {
              allSeances = allSeances.concat(pageResponse.data.content);
            }
          });
        }
        
        return allSeances;
      }
      
      // Non-paginated response (array)
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      // Fallback: return empty array if format is unexpected
      console.warn('Unexpected seances response format:', response.data);
      return [];
      
    } catch (error) {
      console.error('Error fetching all seances:', error);
      
      // Fallback: try without parameters
      try {
        const fallbackResponse = await api.get('/seances');
        if (Array.isArray(fallbackResponse.data)) {
          return fallbackResponse.data;
        }
        if (fallbackResponse.data && fallbackResponse.data.content) {
          return fallbackResponse.data.content;
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
      
      return [];
    }
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
   * Survey Conflict Detection
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
   * FIXED: Returns true if the teacher already has an assignment that overlaps with the target session.
   * 
   * Teachers cannot be assigned to multiple sessions that have overlapping time intervals.
   * 
   * Two time intervals overlap if:
   * - Interval A: [start1, end1]
   * - Interval B: [start2, end2]
   * - Overlap condition: start1 < end2 AND start2 < end1
   * 
   * Example overlaps that are now correctly detected:
   * - Existing: 8:00-10:00, Target: 9:00-11:00 ✓ (overlaps)
   * - Existing: 8:00-10:00, Target: 8:30-9:30 ✓ (overlaps)
   * - Existing: 8:00-10:00, Target: 7:30-8:30 ✓ (overlaps)
   * - Existing: 8:00-10:00, Target: 10:00-12:00 ✗ (no overlap - end equals start)
   * 
   * @param {Object} teacher - Teacher data with affectations
   * @param {Object} seance - Target session to check
   * @returns {boolean} - True if there's a time conflict
   */
  timeOverlap: (teacher, seance) => {
    if (!teacher || !seance) return false;

    // Extract target session's date and time interval
    const targetDate = seance.date ?? seance.date_seance ?? seance.dateSeance;
    const targetStart = seance.heureDebut ?? seance.heure_debut ?? seance.start;
    const targetEnd = seance.heureFin ?? seance.heure_fin ?? seance.end;

    if (!targetDate || !targetStart || !targetEnd) return false;

    // Convert time string (HH:mm) to minutes for comparison
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
    };

    const targetStartMin = parseTime(targetStart);
    const targetEndMin = parseTime(targetEnd);

    // Get teacher's existing affectations
    const affectations = teacher.affectations || teacher.enseignantDTO?.affectations || [];
    if (!Array.isArray(affectations) || affectations.length === 0) return false;

    // Check each affectation for time overlap
    return affectations.some(a => {
      const s = a.seance || a;
      const affDate = s.date ?? s.date_seance ?? s.dateSeance;
      const affStart = s.heureDebut ?? s.heure_debut ?? s.start;
      const affEnd = s.heureFin ?? s.heure_fin ?? s.end;
      
      // Must be on the same date
      if (affDate !== targetDate) return false;
      
      // Must have valid time data
      if (!affStart || !affEnd) return false;

      const affStartMin = parseTime(affStart);
      const affEndMin = parseTime(affEnd);

      // Check for overlap: affStart < targetEnd AND targetStart < affEnd
      // This correctly detects all overlapping intervals
      return affStartMin < targetEndMin && targetStartMin < affEndMin;
    });
  }
};

export default ExamService;