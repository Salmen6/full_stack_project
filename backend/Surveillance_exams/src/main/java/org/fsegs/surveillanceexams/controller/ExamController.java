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

    @GetMapping("/enseignants/by-user/{idUser}")
    public ResponseEntity<EnseignantDTO> getEnseignantByUser(@PathVariable Long idUser) {
        Enseignant e = service.getEnseignantByUserId(idUser);
        if (e == null) return ResponseEntity.notFound().build();
        EnseignantDTO dto = service.toDTO(e);
        return ResponseEntity.ok(dto);
    }

    // =========================
    // VOEUX (WISHES) - Updated with detailed response
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

            // Fetch linked EnseignantDTO if user is a teacher
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