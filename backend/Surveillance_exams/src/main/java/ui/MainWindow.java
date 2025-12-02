package ui;

import javax.swing.*;

public class MainWindow {

    public static void main(String[] args) {
        JFrame f = new JFrame("Gestion des surveillances");
        f.setSize(400, 200);
        f.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JLabel label = new JLabel("Bienvenue dans le système de gestion des surveillances");
        f.add(label);

        f.setVisible(true);
    }
}
