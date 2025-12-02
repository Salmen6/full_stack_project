package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "matiere")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Matiere {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_matiere")
    private Long id;

    @Column(name = "nom", nullable = false)
    private String nom;
}
