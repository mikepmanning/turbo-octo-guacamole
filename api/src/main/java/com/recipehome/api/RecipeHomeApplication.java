package com.recipehome.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RecipeHomeApplication {

    public static void main(String[] args) {
        System.out.println("CWD is: " + System.getProperty("user.dir"));
        SpringApplication.run(RecipeHomeApplication.class, args);
    }

}
