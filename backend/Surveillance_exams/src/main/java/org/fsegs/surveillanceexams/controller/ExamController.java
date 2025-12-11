package org.fsegs.surveillanceexams.controller;

import lombok.RequiredArgsConstructor;
import org.fsegs.surveillanceexams.dto.EnseignantDTO;
import org.fsegs.surveillanceexams.model.*;
import org.fsegs.surveillanceexams.service.SurveillanceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class ExamController {

    private final SurveillanceService service;

    // =========================
    // SEANCES
    // =========================
    @GetMapping("/seances")
    public List<Seance> getAllSeances() {
        return service.getAllSeances();
    }

    @PostMapping("/seances/{id}/calculate-needs")
    public ResponseEntity<String> calculateNeeds(@PathVariable Long id) {
        service.updateSeanceNeeds(id);
        return ResponseEntity.ok("Needs updated");
    }

    /**
     * NEW: Batch update all seances to recalculate surveillance needs.
     * 
     * This applies CONSTRAINT 2 to all sessions:
     * nbSurveillantsNecessaires = sum of paquets * 1.5
     * 
     * Useful after database changes or initialization.
     * 
     * @return Success message with count of updated sessions
     */
    @PostMapping("/seances/calculate-all-needs")
    public ResponseEntity<Map<String, Object>> calculateAllNeeds() {
        List<Seance> allSeances = service.getAllSeances();
        int updated = 0;
        
        for (Seance s : allSeances) {
            try {
                service.updateSeanceNeeds(s.getId());
                updated++;
            } catch (Exception e) {
                // Continue with next seance even if one fails
                System.err.println("Failed to update seance " + s.getId() + ": " + e.getMessage());
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Updated " + updated + " out of " + allSeances.size() + " sessions");
        response.put("totalSeances", allSeances.size());
        response.put("updatedSeances", updated);
        
        return ResponseEntity.ok(response);
    }

    // =========================
    // ENSEIGNANTS
    // =========================
    @GetMapping("/enseignants")
    public List<Enseignant> getAllEnseignants() {
        return service.getAllEnseignants();
    }

    @PostMapping("/enseignants/{id}/calculate-load")
    public ResponseEntity<String> calculateLoad(@PathVariable Long id) {
        service.updateEnseignantLoad(id);
        return ResponseEntity.ok("Load updated");
    }

    /**
     * NEW: Batch update all teachers to recalculate surveillance loads.
     * 
     * This applies CONSTRAINT 1 to all teachers:
     * chargeSurveillance = (chargeEnseignement * 1.5) - nbSessionsOfOwnSubjects
     * 
     * Useful after database changes or initialization.
     * 
     * @return Success message with count of updated teachers
     */
    @PostMapping("/enseignants/calculate-all-loads")
    public ResponseEntity<Map<String, Object>> calculateAllLoads() {
        List<Enseignant> allTeachers = service.getAllEnseignants();
        int updated = 0;
        
        for (Enseignant e : allTeachers) {
            try {
                service.updateEnseignantLoad(e.getId());
                updated++;
            } catch (Exception ex) {
                // Continue with next teacher even if one fails
                System.err.println("Failed to update enseignant " + e.getId() + ": " + ex.getMessage());
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Updated " + updated + " out of " + allTeachers.size() + " teachers");
        response.put("totalTeachers", allTeachers.size());
        response.put("updatedTeachers", updated);
        
        return ResponseEntity.ok(response);
    }

    /**
     * NEW: Initialize entire system by recalculating both session needs and teacher loads.
     * 
     * This applies both constraints across the entire database:
     * - CONSTRAINT 1: Teacher surveillance loads
     * - CONSTRAINT 2: Session supervisor requirements
     * 
     * Should be called after data import or significant database changes.
     * 
     * @return Success message with details of all updates
     */
    @PostMapping("/system/initialize-constraints")
    public ResponseEntity<Map<String, Object>> initializeConstraints() {
        Map<String, Object> response = new HashMap<>();
        
        // Update all seances
        List<Seance> allSeances = service.getAllSeances();
        int seancesUpdated = 0;
        for (Seance s : allSeances) {
            try {
                service.updateSeanceNeeds(s.getId());
                seancesUpdated++;
            } catch (Exception e) {
                System.err.println("Failed to update seance " + s.getId() + ": " + e.getMessage());
            }
        }
        
        // Update all teachers
        List<Enseignant> allTeachers = service.getAllEnseignants();
        int teachersUpdated = 0;
        for (Enseignant e : allTeachers) {
            try {
                service.updateEnseignantLoad(e.getId());
                teachersUpdated++;
            } catch (Exception ex) {
                System.err.println("Failed to update enseignant " + e.getId() + ": " + ex.getMessage());
            }
        }
        
        response.put("success", true);
        response.put("message", "System initialized: " + seancesUpdated + " sessions and " + teachersUpdated + " teachers updated");
        response.put("seances", Map.of(
            "total", allSeances.size(),
            "updated", seancesUpdated
        ));
        response.put("teachers", Map.of(
            "total", allTeachers.size(),
            "updated", teachersUpdated
        ));
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/enseignants/by-user/{idUser}")
    public ResponseEntity<EnseignantDTO> getEnseignantByUser(@PathVariable Long idUser) {
        Enseignant e = service.getEnseignantByUserId(idUser);
        if (e == null) return ResponseEntity.notFound().build();
        EnseignantDTO dto = service.toDTO(e);
        return ResponseEntity.ok(dto);
    }

    // =========================
    // VOEUX (WISHES)
    // =========================
    @PostMapping("/voeux")
    public ResponseEntity<Map<String, Object>> submitVoeu(
            @RequestParam Long idEnseignant, 
            @RequestParam Long idSeance) {
        try {
            String result = service.soumettreVoeu(idEnseignant, idSeance);
            
            Map<String, Object> response = new HashMap<>();
            boolean success = result.contains("successfully");
            
            response.put("success", success);
            response.put("message", result);
            
            if (success) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/voeux")
    public List<Voeu> getAllVoeux() {
        return service.getAllVoeux();
    }

    @DeleteMapping("/voeux")
    public ResponseEntity<Map<String, Object>> cancelVoeu(
            @RequestParam Long idEnseignant,
            @RequestParam Long idSeance) {
        try {
            String result = service.cancelVoeu(idEnseignant, idSeance);
            
            Map<String, Object> response = new HashMap<>();
            boolean success = result.contains("successfully");
            
            response.put("success", success);
            response.put("message", result);
            
            if (success) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    // =========================
    // AFFECTATION (ASSIGNMENT)
    // =========================
    @PostMapping("/affectation")
    public ResponseEntity<String> assignTeacher(
            @RequestParam Long idEnseignant, 
            @RequestParam Long idSeance) {
        String result = service.affecterSurveillant(idSeance, idEnseignant);
        if (result.equals("Assignment successful")) {
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.badRequest().body(result);
    }

    @GetMapping("/affectations")
    public List<Affectation> getAllAffectations() {
        return service.getAllAffectations();
    }

    // =========================
    // LOGIN
    // =========================
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = service.login(request.getLogin(), request.getPassword());

            EnseignantDTO enseignantDTO = null;
            if (user.getIdEnseignant() != null) {
                Enseignant e = service.getEnseignantByUserId(user.getIdUser());
                enseignantDTO = service.toDTO(e);
            }

            return ResponseEntity.ok(new LoginResponse(user, enseignantDTO));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // =========================
    // DTOs
    // =========================
    public static class LoginRequest {
        private String login;
        private String password;

        public String getLogin() { return login; }
        public void setLogin(String login) { this.login = login; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class LoginResponse {
        private Long idUser;
        private String login;
        private User.Role role;
        private String redirect;
        private EnseignantDTO enseignant;

        public LoginResponse(User user, EnseignantDTO enseignantDTO) {
            this.idUser = user.getIdUser();
            this.login = user.getLogin();
            this.role = user.getRole();
            this.redirect = user.isAdmin() ? "/admin" : "/teacher";
            this.enseignant = enseignantDTO;
        }

        public Long getIdUser() { return idUser; }
        public String getLogin() { return login; }
        public User.Role getRole() { return role; }
        public String getRedirect() { return redirect; }
        public EnseignantDTO getEnseignant() { return enseignant; }
    }
}