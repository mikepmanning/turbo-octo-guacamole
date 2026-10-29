package com.recipehome.api.mapper;

import com.recipehome.api.dto.IngredientDTO;
import com.recipehome.api.entity.Ingredient;
import org.springframework.stereotype.Component;

@Component
public class IngredientMapper {

    public IngredientDTO toDTO(Ingredient ingredient) {
        if (ingredient == null) {
            return null;
        }

        IngredientDTO dto = new IngredientDTO();
        dto.setId(ingredient.getId());
        dto.setName(ingredient.getName());
        dto.setQuantity(ingredient.getQuantity());
        dto.setUnit(ingredient.getUnit());
        dto.setPackageQuantity(ingredient.getPackageQuantity());
        dto.setPackageUnit(ingredient.getPackageUnit());

        return dto;
    }

    public Ingredient toEntity(IngredientDTO dto) {
        if (dto == null) {
            return null;
        }

        Ingredient ingredient = new Ingredient();
        ingredient.setName(dto.getName());
        ingredient.setQuantity(dto.getQuantity());
        ingredient.setUnit(dto.getUnit());
        ingredient.setPackageQuantity(dto.getPackageQuantity());
        ingredient.setPackageUnit(dto.getPackageUnit());

        return ingredient;
    }

    public void updateEntityFromDTO(IngredientDTO dto, Ingredient ingredient) {
        ingredient.setName(dto.getName());
        ingredient.setQuantity(dto.getQuantity());
        ingredient.setUnit(dto.getUnit());
        ingredient.setPackageQuantity(dto.getPackageQuantity());
        ingredient.setPackageUnit(dto.getPackageUnit());
    }
}
