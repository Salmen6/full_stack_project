package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "seance")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Seance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_seance")
    private Long id;

    @Column(name = "date_seance")
    private LocalDate date;

    @Column(name = "heure_debut")
    private LocalTime heureDebut;

    @Column(name = "heure_fin")
    private LocalTime heureFin;

    @Column(name = "nb_surveillants_necessaires")
    private int nbSurveillantsNecessaires;

    @Column(name = "nb_surveillants_inscrits")
    private int nbSurveillantsInscrits;

    @OneToMany(mappedBy = "seance", cascade = CascadeType.ALL)
    @JsonManagedReference
    private Set<Epreuve> epreuves = new HashSet<>();

    public boolean isSaturee() {
        return nbSurveillantsInscrits >= nbSurveillantsNecessaires;
    }
}
