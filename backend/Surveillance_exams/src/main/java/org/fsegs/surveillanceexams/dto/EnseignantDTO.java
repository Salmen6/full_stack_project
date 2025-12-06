package org.fsegs.surveillanceexams.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class EnseignantDTO {

    private Long id;
    private String nomComplet;
    private String grade;
    private Double chargeEnseignement;
    private Double chargeSurveillance;

    private List<AffectationDTO> affectations;
    
    // NEW: Added to include teacher's subjects in the response
    // This allows frontend to check for subject conflicts
    private List<MatiereDTO> matieres;

    @Getter
    @Setter
    public static class AffectationDTO {
        private Long id;
        private SeanceDTO seance;

        @Getter
        @Setter
        public static class SeanceDTO {
            private Long id;
            private String date; // "yyyy-MM-dd"
            private String heureDebut; // "HH:mm"
            private String heureFin; // "HH:mm"
            private int nbSurveillantsNecessaires;
            private int nbSurveillantsInscrits;

            private List<EpreuveDTO> epreuves;

            @Getter
            @Setter
            public static class EpreuveDTO {
                private Long id;
                private String nom;
                
                // NEW: Added to identify subject in epreuve
                // This enables subject conflict detection on frontend
                private MatiereDTO matiere;
            }
        }
    }
    
    // NEW: DTO for subject/matiere information
    // Used both for teacher's subjects and epreuve subjects
    @Getter
    @Setter
    public static class MatiereDTO {
        private Long id;
        private String nom;
    }
}