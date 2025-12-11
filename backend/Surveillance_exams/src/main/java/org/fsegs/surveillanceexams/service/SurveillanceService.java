package org.fsegs.surveillanceexams.service;

import lombok.RequiredArgsConstructor;
import org.fsegs.surveillanceexams.dto.EnseignantDTO;
import org.fsegs.surveillanceexams.model.*;
import org.fsegs.surveillanceexams.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SurveillanceService {

    private final SeanceRepository seanceRepo;
    private final EnseignantRepository enseignantRepo;
    private final VoeuRepository voeuRepo;
    private final AffectationRepository affectationRepo;
    private final UserRepository userRepo;
    private final EpreuveRepository epreuveRepo;

    // =========================
    // SEANCES
    // =========================
    public List<Seance> getAllSeances() {
        return seanceRepo.findAll();
    }

    public void updateSeanceNeeds(Long idSeance) {
        Seance s = seanceRepo.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));

        int needed = s.getEpreuves().size() * 2; // Example logic
        s.setNbSurveillantsNecessaires(needed);
        seanceRepo.save(s);
    }

    // =========================
    // ENSEIGNANTS
    // =========================
    public List<Enseignant> getAllEnseignants() {
        return enseignantRepo.findAll();
    }

    public Enseignant getEnseignantByUserId(Long idUser) {
        User user = userRepo.findById(idUser)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getEnseignant();
    }

    public void updateEnseignantLoad(Long idEnseignant) {
        Enseignant e = enseignantRepo.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Enseignant not found"));

        double load = calculateSurveillanceLoad(e);
        e.setChargeSurveillance(load);
        enseignantRepo.save(e);
    }

    private double calculateSurveillanceLoad(Enseignant e) {
        double baseLoad = e.getChargeEnseignement() / 10.0;

        long sessionsInSubjects = e.getMatieres().stream()
                .mapToLong(m -> seanceRepo.countSeancesByMatiereId(m.getId()))
                .sum();

        return Math.max(3.0, baseLoad + (sessionsInSubjects * 0.1));
    }

    // =========================
    // TO DTO
    // =========================
    public EnseignantDTO toDTO(Enseignant e) {
        if (e == null) return null;

        EnseignantDTO dto = new EnseignantDTO();
        dto.setId(e.getId());
        dto.setNomComplet(e.getNomComplet());
        dto.setGrade(e.getGrade());
        dto.setChargeEnseignement(e.getChargeEnseignement());
        dto.setChargeSurveillance(e.getChargeSurveillance());

        // Map teacher's subjects (matieres)
        if (e.getMatieres() != null) {
            List<EnseignantDTO.MatiereDTO> matiereDTOs = e.getMatieres().stream()
                    .map(m -> {
                        EnseignantDTO.MatiereDTO mDto = new EnseignantDTO.MatiereDTO();
                        mDto.setId(m.getId());
                        mDto.setNom(m.getNom());
                        return mDto;
                    })
                    .collect(Collectors.toList());
            dto.setMatieres(matiereDTOs);
        }

        // Map affectations
        if (e.getAffectations() != null) {
            List<EnseignantDTO.AffectationDTO> affDTOs = e.getAffectations().stream()
                    .map(aff -> {
                        EnseignantDTO.AffectationDTO aDto = new EnseignantDTO.AffectationDTO();
                        aDto.setId(aff.getId());

                        Seance s = aff.getSeance();
                        if (s != null) {
                            EnseignantDTO.AffectationDTO.SeanceDTO sDto =
                                    new EnseignantDTO.AffectationDTO.SeanceDTO();
                            sDto.setId(s.getId());
                            sDto.setDate(s.getDate() != null ? s.getDate().toString() : null);
                            sDto.setHeureDebut(s.getHeureDebut() != null ? s.getHeureDebut().toString() : null);
                            sDto.setHeureFin(s.getHeureFin() != null ? s.getHeureFin().toString() : null);
                            sDto.setNbSurveillantsNecessaires(s.getNbSurveillantsNecessaires());
                            sDto.setNbSurveillantsInscrits(s.getNbSurveillantsInscrits());

                            // Map epreuves with matiere
                            if (s.getEpreuves() != null) {
                                List<EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO> epDTOs =
                                        s.getEpreuves().stream()
                                                .map(ep -> {
                                                    EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO epDto =
                                                            new EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO();
                                                    epDto.setId(ep.getId());
                                                    epDto.setNom(ep.getMatiere() != null ? ep.getMatiere().getNom() : null);

                                                    if (ep.getMatiere() != null) {
                                                        EnseignantDTO.MatiereDTO mDto = new EnseignantDTO.MatiereDTO();
                                                        mDto.setId(ep.getMatiere().getId());
                                                        mDto.setNom(ep.getMatiere().getNom());
                                                        epDto.setMatiere(mDto);
                                                    }

                                                    return epDto;
                                                })
                                                .collect(Collectors.toList());
                                sDto.setEpreuves(epDTOs);
                            }

                            aDto.setSeance(sDto);
                        }

                        return aDto;
                    })
                    .collect(Collectors.toList());
            dto.setAffectations(affDTOs);
        }

        return dto;
    }

    // =========================
    // VOEUX (WISHES)
    // =========================
    @Transactional
    public String soumettreVoeu(Long idEnseignant, Long idSeance) {
        Enseignant ens = enseignantRepo.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Enseignant not found"));
        Seance seance = seanceRepo.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));

        if (voeuRepo.existsByEnseignantAndSeance(ens, seance)) {
            return "Wish already submitted for this session.";
        }
        if (seance.isSaturee()) {
            return "Session is already saturated.";
        }
        if (hasSubjectConflict(ens, seance)) {
            return "Cannot supervise sessions with your own subjects.";
        }
        if (hasTimeConflict(ens, seance)) {
            return "Time conflict with existing assignment.";
        }

        long currentAssignments = ens.getAffectations().size();
        Double chargeSurveillance = ens.getChargeSurveillance();
        if (chargeSurveillance != null && currentAssignments >= chargeSurveillance) {
            return "You have reached your surveillance quota (" + chargeSurveillance + " sessions).";
        }

        Voeu voeu = new Voeu();
        voeu.setEnseignant(ens);
        voeu.setSeance(seance);
        voeu.setDateSoumission(LocalDateTime.now());
        voeuRepo.save(voeu);

        Affectation affectation = new Affectation(ens, seance);
        affectationRepo.save(affectation);

        seance.setNbSurveillantsInscrits(seance.getNbSurveillantsInscrits() + 1);
        seanceRepo.save(seance);

        return "Wish submitted and assignment created successfully!";
    }

    /**
     * NEW: Cancel a teacher's wish and remove the associated assignment.
     * 
     * This method performs the following operations in a transaction:
     * 1. Validates that both teacher and session exist
     * 2. Checks if a wish exists for this teacher-session combination
     * 3. Deletes the Voeu (wish) record from the database
     * 4. Deletes the corresponding Affectation (assignment)
     * 5. Decrements the nbSurveillantsInscrits counter on the Seance
     * 
     * @param idEnseignant The teacher's ID
     * @param idSeance The session ID
     * @return Success or error message
     */
    @Transactional
    public String cancelVoeu(Long idEnseignant, Long idSeance) {
        // Validate teacher exists
        Enseignant ens = enseignantRepo.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Enseignant not found"));
        
        // Validate session exists
        Seance seance = seanceRepo.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));

        // Check if wish exists
        if (!voeuRepo.existsByEnseignantAndSeance(ens, seance)) {
            return "No wish found for this session.";
        }

        // Check if assignment exists
        if (!affectationRepo.existsByEnseignantAndSeance(ens, seance)) {
            // Edge case: wish exists but no assignment (shouldn't happen in normal flow)
            // Still delete the wish to maintain consistency
            voeuRepo.findByEnseignant(ens).stream()
                    .filter(v -> v.getSeance().getId().equals(idSeance))
                    .forEach(voeuRepo::delete);
            return "Wish cancelled (no assignment found).";
        }

        try {
            // 1. Delete the Voeu (wish) record
            voeuRepo.findByEnseignant(ens).stream()
                    .filter(v -> v.getSeance().getId().equals(idSeance))
                    .forEach(voeuRepo::delete);

            // 2. Delete the corresponding Affectation (assignment)
            affectationRepo.deleteByEnseignantAndSeance(ens, seance);

            // 3. Decrement the supervisor count on the session
            int currentCount = seance.getNbSurveillantsInscrits();
            if (currentCount > 0) {
                seance.setNbSurveillantsInscrits(currentCount - 1);
                seanceRepo.save(seance);
            }

            return "Wish and assignment cancelled successfully!";
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to cancel wish: " + e.getMessage());
        }
    }

    public List<Voeu> getAllVoeux() {
        return voeuRepo.findAll();
    }

    // =========================
    // AFFECTATION
    // =========================
    @Transactional
    public String affecterSurveillant(Long idSeance, Long idEnseignant) {
        Seance s = seanceRepo.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));
        Enseignant e = enseignantRepo.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Enseignant not found"));

        if (affectationRepo.existsByEnseignantAndSeance(e, s)) {
            return "Already assigned";
        }
        if (s.isSaturee()) {
            return "Session full";
        }
        if (hasSubjectConflict(e, s)) {
            return "Subject conflict";
        }
        if (hasTimeConflict(e, s)) {
            return "Time conflict";
        }
        if (!e.canTakeMoreSurveillances()) {
            return "Teacher has reached maximum surveillance load";
        }

        Affectation aff = new Affectation(e, s);
        affectationRepo.save(aff);

        s.setNbSurveillantsInscrits(s.getNbSurveillantsInscrits() + 1);
        seanceRepo.save(s);

        return "Assignment successful";
    }

    public List<Affectation> getAllAffectations() {
        return affectationRepo.findAll();
    }

    // =========================
    // CONFLICT DETECTION HELPERS
    // =========================
    private boolean hasSubjectConflict(Enseignant ens, Seance seance) {
        Set<Long> teacherMatiereIds = ens.getMatieres().stream()
                .map(Matiere::getId)
                .collect(Collectors.toSet());

        List<Matiere> matieresInSeance = epreuveRepo.findMatieresBySeanceId(seance.getId());

        return matieresInSeance.stream()
                .anyMatch(m -> teacherMatiereIds.contains(m.getId()));
    }

    /**
     * FIXED: Now properly checks for overlapping time intervals.
     * 
     * Returns true if the teacher has any existing assignment that overlaps
     * with the given seance's time interval.
     * 
     * Two intervals overlap if: start1 < end2 AND start2 < end1
     * 
     * @param ens The teacher to check
     * @param seance The new seance to check against
     * @return true if there's a time conflict
     */
    private boolean hasTimeConflict(Enseignant ens, Seance seance) {
        LocalDate date = seance.getDate();
        LocalTime heureDebut = seance.getHeureDebut();
        LocalTime heureFin = seance.getHeureFin();

        // Validate that we have all required time information
        if (date == null || heureDebut == null || heureFin == null) {
            return false;
        }

        // Use the updated repository method that checks for overlapping intervals
        return affectationRepo.existsByEnseignantAndSeanceDateTime(ens, date, heureDebut, heureFin);
    }

    // =========================
    // LOGIN
    // =========================
    public User login(String login, String password) {
        User user = userRepo.findByLogin(login)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!user.getPassword().equals(password)) {
            throw new RuntimeException("Invalid credentials");
        }

        return user;
    }
}