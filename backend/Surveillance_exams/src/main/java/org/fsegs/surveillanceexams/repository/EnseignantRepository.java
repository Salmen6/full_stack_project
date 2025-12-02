package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Enseignant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnseignantRepository extends JpaRepository<Enseignant, Long> {
}