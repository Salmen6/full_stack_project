package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Seance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeanceRepository extends JpaRepository<Seance, Long> {
    // Count how many seances contain an epreuve of a specific matiere
    // Formula requirement: "nombre de séances de ses matières"
    @Query("SELECT COUNT(DISTINCT s) FROM Seance s JOIN s.epreuves e JOIN e.paquets p WHERE p.matiere.id = :matiereId")
    long countSeancesByMatiereId(@Param("matiereId") Long matiereId);
}