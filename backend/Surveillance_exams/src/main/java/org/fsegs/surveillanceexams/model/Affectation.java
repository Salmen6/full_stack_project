package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "affectation")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Affectation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_affectation")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_enseignant")
    @JsonBackReference
    private Enseignant enseignant;

    @ManyToOne
    @JoinColumn(name = "id_seance")
    @JsonManagedReference
    private Seance seance;

    public Affectation(Enseignant enseignant, Seance seance) {
        this.enseignant = enseignant;
        this.seance = seance;
    }
}
