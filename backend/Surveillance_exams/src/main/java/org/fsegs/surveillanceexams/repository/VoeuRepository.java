package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Voeu;
import org.fsegs.surveillanceexams.model.Enseignant;
import org.fsegs.surveillanceexams.model.Seance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VoeuRepository extends JpaRepository<Voeu, Long> {
    List<Voeu> findByEnseignant(Enseignant enseignant);
    boolean existsByEnseignantAndSeance(Enseignant enseignant, Seance seance);
}