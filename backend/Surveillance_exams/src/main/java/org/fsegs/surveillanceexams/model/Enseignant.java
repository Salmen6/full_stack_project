package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "enseignant")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Enseignant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_enseignant")
    private Long id;

    @Column(name = "nom", nullable = false)
    private String nomComplet;

    @Column(name = "grade")
    private String grade;

    @Column(name = "charge_enseignement", nullable = false)
    private Double chargeEnseignement;

    @Column(name = "charge_surveillance")
    private Double chargeSurveillance;

    @OneToMany(mappedBy = "enseignant")
    @JsonIgnore
    private List<User> users;

    @OneToMany(mappedBy = "enseignant", cascade = CascadeType.ALL)
    @JsonManagedReference
    private Set<Affectation> affectations = new HashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "enseignant_matiere",
        joinColumns = @JoinColumn(name = "id_enseignant"),
        inverseJoinColumns = @JoinColumn(name = "id_matiere")
    )
    private Set<Matiere> matieres = new HashSet<>();

    public boolean canTakeMoreSurveillances() {
        if (chargeSurveillance == null) return true;
        return affectations.size() < chargeSurveillance;
    }
}
