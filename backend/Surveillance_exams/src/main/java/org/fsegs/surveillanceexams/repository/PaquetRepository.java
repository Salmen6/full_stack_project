package org.fsegs.surveillanceexams.repository;

import org.fsegs.surveillanceexams.model.Paquet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PaquetRepository extends JpaRepository<Paquet, Long> {
    
    /**
     * Count the total number of paquets for all epreuves in a given seance.
     * This is used to calculate the required number of surveillants.
     * 
     * Formula: nbSurveillantsNecessaires = countPaquetsBySeanceId(seanceId) * 1.5
     * 
     * @param idSeance The session ID
     * @return Total number of paquets across all epreuves in the session
     */
    @Query("SELECT COUNT(p) FROM Paquet p WHERE p.epreuve.seance.id = :idSeance")
    long countPaquetsBySeanceId(@Param("idSeance") Long idSeance);
    
    /**
     * Count paquets for a specific epreuve.
     * Useful for detailed calculations or debugging.
     * 
     * @param idEpreuve The epreuve ID
     * @return Number of paquets for this epreuve
     */
    @Query("SELECT COUNT(p) FROM Paquet p WHERE p.epreuve.id = :idEpreuve")
    long countPaquetsByEpreuveId(@Param("idEpreuve") Long idEpreuve);
}