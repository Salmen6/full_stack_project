package org.fsegs.surveillanceexams.service;

import lombok.RequiredArgsConstructor;
import org.fsegs.surveillanceexams.dto.EnseignantDTO;
import org.fsegs.surveillanceexams.model.*;
import org.fsegs.surveillanceexams.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SurveillanceService {

    private final SeanceRepository seanceRepository;
    private final EnseignantRepository enseignantRepository;
    private final AffectationRepository affectationRepository;
    private final VoeuRepository voeuRepository;
    private final EpreuveRepository epreuveRepository;
    private final UserRepository userRepository;

    private final DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private final DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");

    // =========================
    // LOGIN
    // =========================
    public User login(String login, String password) {
        return userRepository.findByLogin(login)
                .filter(u -> u.getPassword().equals(password)) // plaintext check; replace with BCrypt in production
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
    }

    // =========================
    // SEANCES
    // =========================
    @Transactional
    public void updateSeanceNeeds(Long idSeance) {
        Seance s = seanceRepository.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));
        int totalPaquets = s.getEpreuves().stream()
                .mapToInt(epreuve -> epreuve.getPaquets().size())
                .sum();
        int needed = (int) Math.ceil(totalPaquets * 1.5);
        s.setNbSurveillantsNecessaires(needed);
        seanceRepository.save(s);
    }

    public List<Seance> getAllSeances() {
        return seanceRepository.findAll();
    }

    // =========================
    // ENSEIGNANTS
    // =========================
    @Transactional
    public void updateEnseignantLoad(Long idEnseignant) {
        Enseignant e = enseignantRepository.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Enseignant not found"));

        if (e.getChargeEnseignement() == null) return;

        long sessionsCount = e.getMatieres().stream()
                .mapToLong(m -> seanceRepository.countSeancesByMatiereId(m.getId()))
                .sum();

        double calculatedLoad = (e.getChargeEnseignement() * 1.5) - sessionsCount;
        e.setChargeSurveillance(Math.max(0, calculatedLoad));
        enseignantRepository.save(e);
    }

    public List<Enseignant> getAllEnseignants() {
        return enseignantRepository.findAll();
    }

    public Enseignant getEnseignantByUserId(Long idUser) {
        User user = userRepository.findById(idUser)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Long idEnseignant = user.getIdEnseignant();
        if (idEnseignant == null) return null;
        return enseignantRepository.findById(idEnseignant).orElse(null);
    }

    // =========================
    // AFFECTATION
    // =========================
    @Transactional
    public String affecterSurveillant(Long idSeance, Long idEnseignant) {
        Seance s = seanceRepository.findById(idSeance)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        Enseignant e = enseignantRepository.findById(idEnseignant)
                .orElseThrow(() -> new IllegalArgumentException("Teacher not found"));

        if (s.isSaturee()) return "Session is full (Saturated)";
        if (affectationRepository.existsByEnseignantAndSeance(e, s)) return "Already assigned";
        if (!e.canTakeMoreSurveillances()) return "Teacher quota reached";

        Affectation a = new Affectation(e, s);
        affectationRepository.save(a);

        s.setNbSurveillantsInscrits(s.getNbSurveillantsInscrits() + 1);
        seanceRepository.save(s);

        return "Assignment successful";
    }

    @Transactional(readOnly = true)
    public List<Affectation> getAllAffectations() {
        return affectationRepository.findAll();
    }

    // =========================
    // VOEUX (WISHES)
    // =========================
    @Transactional
    public String soumettreVoeu(Long idEnseignant, Long idSeance) {
        Seance s = seanceRepository.findById(idSeance)
                .orElseThrow(() -> new RuntimeException("Seance not found"));
        Enseignant e = enseignantRepository.findById(idEnseignant)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        if (s.isSaturee()) return "Session saturated, cannot wish";
        if (voeuRepository.existsByEnseignantAndSeance(e, s)) return "Wish already submitted";

        Voeu v = new Voeu();
        v.setEnseignant(e);
        v.setSeance(s);
        voeuRepository.save(v);
        return "Wish submitted";
    }

    @Transactional(readOnly = true)
    public List<Voeu> getAllVoeux() {
        return voeuRepository.findAll();
    }

    // =========================
    // DTO CONVERSION
    // =========================
    public EnseignantDTO toDTO(Enseignant e) {
        if (e == null) return null;

        EnseignantDTO dto = new EnseignantDTO();
        dto.setId(e.getId());
        dto.setNomComplet(e.getNomComplet());
        dto.setGrade(e.getGrade());
        dto.setChargeEnseignement(e.getChargeEnseignement());
        dto.setChargeSurveillance(e.getChargeSurveillance());

        if (e.getAffectations() != null) {
            List<EnseignantDTO.AffectationDTO> aList = e.getAffectations().stream()
                    .map(a -> {
                        EnseignantDTO.AffectationDTO adto = new EnseignantDTO.AffectationDTO();
                        adto.setId(a.getId());

                        Seance s = a.getSeance();
                        if (s != null) {
                            EnseignantDTO.AffectationDTO.SeanceDTO sdto = new EnseignantDTO.AffectationDTO.SeanceDTO();
                            sdto.setId(s.getId());
                            sdto.setDate(s.getDate() != null ? s.getDate().format(dateFormatter) : null);
                            sdto.setHeureDebut(s.getHeureDebut() != null ? s.getHeureDebut().format(timeFormatter) : null);
                            sdto.setHeureFin(s.getHeureFin() != null ? s.getHeureFin().format(timeFormatter) : null);
                            sdto.setNbSurveillantsNecessaires(s.getNbSurveillantsNecessaires());
                            sdto.setNbSurveillantsInscrits(s.getNbSurveillantsInscrits());

                            if (s.getEpreuves() != null) {
                                List<EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO> eps =
                                        s.getEpreuves().stream().map(ep -> {
                                            EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO epdto =
                                                    new EnseignantDTO.AffectationDTO.SeanceDTO.EpreuveDTO();
                                            epdto.setId(ep.getId());
                                            epdto.setNom(ep.getMatiere() != null ? ep.getMatiere().getNom() : null);
                                            return epdto;
                                        }).collect(Collectors.toList());
                                sdto.setEpreuves(eps);
                            }
                            adto.setSeance(sdto);
                        }

                        return adto;
                    })
                    .collect(Collectors.toList());
            dto.setAffectations(aList);
        }

        return dto;
    }
}
