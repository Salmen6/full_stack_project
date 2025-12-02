package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Affectation;
import org.fsegs.surveillanceexams.model.Enseignant;
import org.fsegs.surveillanceexams.model.Seance;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AffectationRepository extends JpaRepository<Affectation, Long> {
    boolean existsByEnseignantAndSeance(Enseignant enseignant, Seance seance);
}