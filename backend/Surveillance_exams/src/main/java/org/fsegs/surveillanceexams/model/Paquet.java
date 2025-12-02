package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "paquet")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Paquet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_paquet")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_epreuve")
    private Epreuve epreuve;

    @ManyToOne
    @JoinColumn(name = "id_matiere")
    private Matiere matiere;
}