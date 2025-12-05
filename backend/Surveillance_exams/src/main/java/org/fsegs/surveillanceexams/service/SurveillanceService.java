package org.fsegs.surveillanceexams.service;

import lombok.RequiredArgsConstructor;
import org.fsegs.surveillanceexams.dto.EnseignantDTO;
import org.fsegs.surveillanceexams.model.*;
import org.fsegs.surveillanceexams.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Central service for surveillance operations.
 *
 * Contains the authoritative validation logic for:
 *  - Preventing teachers submitting wishes for subjects they teach.
 *  - Preventing teachers submitting wishes / being assigned when they already have a surveillance at the same date and start time.
 *
 * It also contains helper conversion to DTOs used by the controller.
 */
@Service
@RequiredArgsConstructor
public class SurveillanceService {

    private final SeanceRepository seanceRepository;
    private final EnseignantRepository enseignantRepository;
    private final VoeuRepository voeuRepository;
    private final AffectationRepository affectationRepository;
    private final EpreuveRepository epreuveRepository;
    private final UserRepository userRepository;

    // =========================
    // Basic fetchers used by controller
    // =========================

    public List<Seance> getAllSeances() {
        return seanceRepository.findAll();
    }

    public List<Enseignant> getAllEnseignants() {
        return enseignantRepository.findAll();
    }

    public Enseignant getEnseignantByUserId(Long idUser) {
        Optional<User> ou = userRepository.findById(idUser);
        if (ou.isEmpty()) return null;
        User u = ou.get();
        if (!u.isTeacher() || u.getEnseignant() == null) return null;
        return enseignantRepository.findById(u.getEnseignant().getId()).orElse(null);
    }

    public EnseignantDTO toDTO(Enseignant e) {
        if (e == null) return null;
        EnseignantDTO dto = new EnseignantDTO();
        dto.setId(e.getId());
        dto.setNomComplet(e.getNomComplet());
        dto.setGrade(e.getGrade());
        dto.setChargeEnseignement(e.getChargeEnseignement());
        dto.setChargeSurveillance(e.getChargeSurveillance());

        // affectations -> DTO
        List<EnseignantDTO.AffectationDTO> affDtos = e.getAffectations().stream().map(a -> {
            EnseignantDTO.AffectationDTO adto = new EnseignantDTO.AffectationDTO();
            adto.setId(a.getId());
            EnseignantDTO.AffectationDTO.SeanceDTO sdto = new EnseignantDTO.AffectationDTO.SeanceDTO();
            Seance s = a.getSeance();
            sdto.setId(s.getId());
            sdto.setDate(s.getDate() != null ? s.getDate().toString() : null);
            sdto.setHeureDebut(s.getHeureDebut() != null ? s.getHeureDebut().toString() : null);
            sdto.setHeureFin(s.getHeureFin() != null ? s.getHeureFin().toString() : null);
            sdto.setNbSurveillantsInscrits(s.getNbSurveillantsInscrits());
            sdto.setNbSurveillantsNecessaires(s.getNbSurveillantsNecessaires());

            // epreuves for the seance
            List<EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO> epDtos = s.getEpreuves().stream().map(ep -> {
                EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO ept = new EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO();
                ept.setId(ep.getId());
                ept.setNom(ep.getMatiere() != null ? ep.getMatiere().getNom() : null);
                return ept;
            }).collect(Collectors.toList());
            sdto.setEpreuves(epDtos);
            adto.setSeance(sdto);
            return adto;
        }).collect(Collectors.toList());

        dto.setAffectations(affDtos);
        return dto;
    }

    public List<Voeu> getAllVoeux() {
        return voeuRepository.findAll();
    }

    public List<Affectation> getAllAffectations() {
        return affectationRepository.findAll();
    }

    public void updateSeanceNeeds(Long id) {
        // placeholder (keeps existing API); if you have logic elsewhere, keep it
        Optional<Seance> os = seanceRepository.findById(id);
        if (os.isPresent()) {
            Seance s = os.get();
            // no-op: real calculation could be more complex
            seanceRepository.save(s);
        }
    }

    public void updateEnseignantLoad(Long id) {
        // placeholder
        Optional<Enseignant> oe = enseignantRepository.findById(id);
        oe.ifPresent(enseignantRepository::save);
    }

    // =========================
    // Authentication (simple, matches controller expectations)
    // =========================
    @Transactional(readOnly = true)
    public User login(String login, String password) {
        Optional<User> ou = userRepository.findByLogin(login);
        if (ou.isEmpty()) throw new RuntimeException("Invalid credentials");
        User u = ou.get();
        if (!u.getPassword().equals(password)) throw new RuntimeException("Invalid credentials");
        return u;
    }

    // =========================
    // Business methods with validation
    // =========================

    /**
     * Submit a wish (voeu) for a teacher for a given seance.
     * Enforces:
     *  - teacher cannot submit for a seance which contains any matiere they teach
     *  - teacher cannot submit for a seance that happens at the same date+start time as one of their assigned surveillance sessions
     *  - seance must not be already saturated
     *  - duplicate voeu prevented by unique constraint & repository check
     *
     * Returns a short status message (controller converts to HTTP response).
     */
    @Transactional
    public String soumettreVoeu(Long idEnseignant, Long idSeance) {
        Optional<Enseignant> oe = enseignantRepository.findById(idEnseignant);
        if (oe.isEmpty()) return "Teacher not found";
        Optional<Seance> os = seanceRepository.findById(idSeance);
        if (os.isEmpty()) return "Session not found";

        Enseignant enseignant = oe.get();
        Seance seance = os.get();

        // 1) check if seance is saturated
        if (seance.isSaturee()) {
            return "saturated: session is already full";
        }

        // 2) check if teacher teaches any matiere in this seance
        List<Matiere> matieresInSeance = epreuveRepository.findMatieresBySeanceId(seance.getId());
        Set<Long> matIdsTeacher = enseignant.getMatieres().stream().map(Matiere::getId).collect(Collectors.toSet());
        for (Matiere m : matieresInSeance) {
            if (m != null && matIdsTeacher.contains(m.getId())) {
                return "You cannot submit a wish for a session containing a subject you teach";
            }
        }

        // 3) check time conflict: teacher already assigned to a seance at same date and start time
        boolean conflict = affectationRepository.existsByEnseignantAndSeanceDateTime(
                enseignant, seance.getDate(), seance.getHeureDebut());
        if (conflict) {
            return "Time conflict: you already have an assigned surveillance at the same date and time";
        }

        // 4) check duplicate voeu
        if (voeuRepository.existsByEnseignantAndSeance(enseignant, seance)) {
            return "already submitted";
        }

        // 5) create voeu
        Voeu v = new Voeu();
        v.setEnseignant(enseignant);
        v.setSeance(seance);
        v.setDateSoumission(java.time.LocalDateTime.now());
        voeuRepository.save(v);

        return "Wish submitted successfully";
    }

    /**
     * Assign a teacher to surveil a seance.
     * Enforces:
     *  - cannot assign a teacher to a seance that contains any matiere they teach
     *  - cannot assign a teacher to a seance that conflicts (same date + start time) with any seance they already surveil
     *  - teacher must not already be assigned to this seance (unique in DB)
     *  - seance must have capacity
     */
    @Transactional
    public String affecterSurveillant(Long idSeance, Long idEnseignant) {
        Optional<Seance> os = seanceRepository.findById(idSeance);
        Optional<Enseignant> oe = enseignantRepository.findById(idEnseignant);

        if (os.isEmpty()) return "Session not found";
        if (oe.isEmpty()) return "Teacher not found";

        Seance seance = os.get();
        Enseignant enseignant = oe.get();

        // 1) check if seance contains a matiere the teacher teaches
        List<Matiere> matieresInSeance = epreuveRepository.findMatieresBySeanceId(seance.getId());
        Set<Long> matIdsTeacher = enseignant.getMatieres().stream().map(Matiere::getId).collect(Collectors.toSet());
        for (Matiere m : matieresInSeance) {
            if (m != null && matIdsTeacher.contains(m.getId())) {
                return "Cannot assign: teacher teaches a subject in this session";
            }
        }

        // 2) time conflict with teacher's assigned surveillances
        boolean conflict = affectationRepository.existsByEnseignantAndSeanceDateTime(
                enseignant, seance.getDate(), seance.getHeureDebut());
        if (conflict) {
            return "Cannot assign: teacher already has assigned surveillance at same date and time";
        }

        // 3) already assigned to this seance?
        if (affectationRepository.existsByEnseignantAndSeance(enseignant, seance)) {
            return "Teacher already assigned to this session";
        }

        // 4) capacity
        if (seance.isSaturee()) {
            return "Session is already full";
        }

        // 5) quota check
        if (!enseignant.canTakeMoreSurveillances()) {
            return "Teacher reached surveillance quota";
        }

        // 6) perform assignment
        Affectation a = new Affectation();
        a.setEnseignant(enseignant);
        a.setSeance(seance);
        affectationRepository.save(a);

        // increment count on seance
        seance.setNbSurveillantsInscrits(seance.getNbSurveillantsInscrits() + 1);
        seanceRepository.save(seance);

        // add to enseignant.affectations (if managed)
        enseignant.getAffectations().add(a);
        enseignantRepository.save(enseignant);

        return "Assignment successful";
    }
}
