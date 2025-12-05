package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Affectation;
import org.fsegs.surveillanceexams.model.Enseignant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;

public interface AffectationRepository extends JpaRepository<Affectation, Long> {
    boolean existsByEnseignantAndSeance(Enseignant enseignant, org.fsegs.surveillanceexams.model.Seance seance);

    /**
     * Returns true if the given enseignant already has any affectation for a seance that occurs
     * on the same date and same heureDebut as provided.
     */
    @Query("SELECT CASE WHEN COUNT(a) > 0 THEN true ELSE false END " +
           "FROM Affectation a " +
           "WHERE a.enseignant = :enseignant AND a.seance.date = :date AND a.seance.heureDebut = :heureDebut")
    boolean existsByEnseignantAndSeanceDateTime(@Param("enseignant") Enseignant enseignant,
                                                @Param("date") LocalDate date,
                                                @Param("heureDebut") LocalTime heureDebut);
}
