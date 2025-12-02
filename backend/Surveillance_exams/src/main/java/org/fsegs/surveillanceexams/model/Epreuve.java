package org.fsegs.surveillanceexams.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.HashSet;
import java.util.Set;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "epreuve")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Epreuve {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="id_epreuve")
    private Long id;

    @Column(name = "filiere")
    private String filiere;

    @Column(name = "classe")
    private String classe;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_seance")
    @JsonBackReference
    private Seance seance;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_matiere")
    private Matiere matiere;

    @OneToMany(mappedBy = "epreuve", cascade = CascadeType.ALL)
    @JsonIgnore
    private Set<Paquet> paquets = new HashSet<>();
}
