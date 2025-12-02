package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idUser;

    // Link to Enseignant if the user is a teacher; null if admin
    @ManyToOne
    @JoinColumn(name = "id_enseignant")
    private Enseignant enseignant;

    @Column(nullable = false, unique = true)
    private String login;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    public enum Role {
        ADMIN,
        TEACHER
    }

    // =============================
    // Helper methods for service
    // =============================

    public boolean isAdmin() {
        return this.role == Role.ADMIN;
    }

    public boolean isTeacher() {
        return this.role == Role.TEACHER && this.enseignant != null;
    }

    // Fixed to match your Enseignant entity
    public Long getIdEnseignant() {
        return isTeacher() ? enseignant.getId() : null;
    }
}
