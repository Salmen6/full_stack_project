package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Voeu;
import org.fsegs.surveillanceexams.model.Enseignant;
import org.fsegs.surveillanceexams.model.Seance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VoeuRepository extends JpaRepository<Voeu, Long> {
    
    /**
     * Find all wishes submitted by a specific teacher
     * @param enseignant The teacher
     * @return List of wishes
     */
    List<Voeu> findByEnseignant(Enseignant enseignant);
    
    /**
     * Check if a wish exists for a specific teacher-session combination
     * @param enseignant The teacher
     * @param seance The session
     * @return true if a wish exists
     */
    boolean existsByEnseignantAndSeance(Enseignant enseignant, Seance seance);
    
    /**
     * NEW: Find a specific wish by teacher and session
     * Useful for deletion operations
     * @param enseignant The teacher
     * @param seance The session
     * @return Optional containing the wish if found
     */
    Optional<Voeu> findByEnseignantAndSeance(Enseignant enseignant, Seance seance);
    
    /**
     * NEW: Delete a wish by teacher and session
     * Used when cancelling a wish
     * @param enseignant The teacher
     * @param seance The session
     */
    @Modifying
    @Query("DELETE FROM Voeu v WHERE v.enseignant = :enseignant AND v.seance = :seance")
    void deleteByEnseignantAndSeance(@Param("enseignant") Enseignant enseignant,
                                     @Param("seance") Seance seance);
}