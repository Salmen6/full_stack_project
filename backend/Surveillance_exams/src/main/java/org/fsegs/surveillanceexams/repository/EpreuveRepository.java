package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Epreuve;
import org.fsegs.surveillanceexams.model.Matiere;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EpreuveRepository extends JpaRepository<Epreuve, Long> {

    /**
     * Returns all matières involved in a given seance.
     * This joins:
     *   Seance -> Epreuve -> Paquet -> Matiere
     */
    @Query("""
        SELECT p.matiere 
        FROM Paquet p 
        WHERE p.epreuve.seance.id = :idSeance
    """)
    List<Matiere> findMatieresBySeanceId(Long idSeance);
}
