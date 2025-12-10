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
     * FIXED: Returns true if the given enseignant has any affectation that overlaps
     * with the provided time interval on the same date.
     * 
     * Overlap logic: Two intervals [A_start, A_end] and [B_start, B_end] overlap if:
     * A_start < B_end AND B_start < A_end
     * 
     * In our case:
     * - Existing assignment: [seance.heureDebut, seance.heureFin]
     * - New assignment: [heureDebut, heureFin]
     * 
     * They overlap if:
     * seance.heureDebut < heureFin AND heureDebut < seance.heureFin
     * 
     * @param enseignant The teacher to check
     * @param date The date to check
     * @param heureDebut The start time of the new session
     * @param heureFin The end time of the new session
     * @return true if there's any overlapping assignment
     */
    @Query("SELECT CASE WHEN COUNT(a) > 0 THEN true ELSE false END " +
           "FROM Affectation a " +
           "WHERE a.enseignant = :enseignant " +
           "AND a.seance.date = :date " +
           "AND a.seance.heureDebut < :heureFin " +
           "AND :heureDebut < a.seance.heureFin")
    boolean existsByEnseignantAndSeanceDateTime(@Param("enseignant") Enseignant enseignant,
                                                @Param("date") LocalDate date,
                                                @Param("heureDebut") LocalTime heureDebut,
                                                @Param("heureFin") LocalTime heureFin);
}