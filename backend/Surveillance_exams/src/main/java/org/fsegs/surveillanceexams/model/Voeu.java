package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "voeu")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Voeu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_voeu")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_enseignant")
    private Enseignant enseignant;

    @ManyToOne
    @JoinColumn(name = "id_seance")
    private Seance seance;

    @Column(name = "date_soumission")
    private LocalDateTime dateSoumission = LocalDateTime.now();
}