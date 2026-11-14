package com.recipehome.api.controller;

import com.recipehome.api.enums.Unit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UnitController.class)
class UnitControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getUnits_ShouldReturnEveryUnitInEnumOrder() throws Exception {
        mockMvc.perform(get("/api/units"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(Unit.values().length)))
                .andExpect(jsonPath("$[0].value").value("TEASPOON"))
                .andExpect(jsonPath("$[0].label").value("teaspoon"))
                .andExpect(jsonPath("$[0].category").value("VOLUME"));
    }

    @Test
    void getUnits_ShouldUseReadableLabelsAndCategories() throws Exception {
        int fluidOunce = Unit.FLUID_OUNCE.ordinal();
        int can = Unit.CAN.ordinal();
        int each = Unit.EACH.ordinal();

        mockMvc.perform(get("/api/units"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[" + fluidOunce + "].value").value("FLUID_OUNCE"))
                .andExpect(jsonPath("$[" + fluidOunce + "].label").value("fluid ounce"))
                .andExpect(jsonPath("$[" + can + "].category").value("CONTAINER"))
                .andExpect(jsonPath("$[" + each + "].label").value("each"))
                .andExpect(jsonPath("$[" + each + "].category").value("COUNT"));
    }
}
