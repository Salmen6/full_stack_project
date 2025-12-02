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
            private String heureFin;   // "HH:mm"
            private int nbSurveillantsNecessaires;
            private int nbSurveillantsInscrits;

            private List<EpreuveDTO> epreuves;

            @Getter
            @Setter
            public static class EpreuveDTO {
                private Long id;
                private String nom;
            }
        }
    }
}
