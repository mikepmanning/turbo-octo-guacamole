package com.recipehome.api.mapper;

import com.recipehome.api.dto.StepDTO;
import com.recipehome.api.entity.Step;
import org.springframework.stereotype.Component;

@Component
public class StepMapper {

    public StepDTO toDTO(Step step) {
        if (step == null) {
            return null;
        }

        StepDTO dto = new StepDTO();
        dto.setId(step.getId());
        dto.setStepOrder(step.getStepOrder());
        dto.setInstructionText(step.getInstructionText());
        dto.setEstimatedTimeMinutes(step.getEstimatedTimeMinutes());

        return dto;
    }

    public Step toEntity(StepDTO dto) {
        if (dto == null) {
            return null;
        }

        Step step = new Step();
        step.setStepOrder(dto.getStepOrder());
        step.setInstructionText(dto.getInstructionText());
        step.setEstimatedTimeMinutes(dto.getEstimatedTimeMinutes());

        return step;
    }

    public void updateEntityFromDTO(StepDTO dto, Step step) {
        step.setStepOrder(dto.getStepOrder());
        step.setInstructionText(dto.getInstructionText());
        step.setEstimatedTimeMinutes(dto.getEstimatedTimeMinutes());
    }
}
