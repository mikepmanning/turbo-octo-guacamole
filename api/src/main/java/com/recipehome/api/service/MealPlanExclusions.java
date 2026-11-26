package com.recipehome.api.service;

import com.recipehome.api.entity.MealPlanExclusion;
import com.recipehome.api.entity.Recipe;
import com.recipehome.api.repository.FamilyRepository;
import com.recipehome.api.repository.MealPlanExclusionRepository;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.security.Viewer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The viewer's "exclude from meal plans" list: their family's, or their own when they have no family. The
 * anonymous viewer has none.
 */
@Service
@Transactional
public class MealPlanExclusions {

    private final MealPlanExclusionRepository repository;
    private final FamilyRepository familyRepository;
    private final UserRepository userRepository;

    public MealPlanExclusions(MealPlanExclusionRepository repository, FamilyRepository familyRepository,
                              UserRepository userRepository) {
        this.repository = repository;
        this.familyRepository = familyRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Set<Long> excludedRecipeIds(Viewer viewer) {
        if (viewer.isAnonymous()) return Set.of();
        return viewer.familyId() != null
                ? repository.findRecipeIdsByFamilyId(viewer.familyId())
                : repository.findRecipeIdsByUserId(viewer.userId());
    }

    /** Excludes these recipes (or includes them again) for the viewer's family; already-set ones are left alone. */
    public void setExcluded(Viewer viewer, List<Recipe> recipes, boolean excluded) {
        if (viewer.isAnonymous() || recipes.isEmpty()) return;
        Collection<Long> ids = recipes.stream().map(Recipe::getId).toList();
        if (!excluded) {
            if (viewer.familyId() != null) repository.deleteByFamilyIdAndRecipeIds(viewer.familyId(), ids);
            else repository.deleteByUserIdAndRecipeIds(viewer.userId(), ids);
            return;
        }
        Set<Long> already = new HashSet<>(excludedRecipeIds(viewer));
        List<MealPlanExclusion> added = recipes.stream()
                .filter(recipe -> already.add(recipe.getId()))
                .map(recipe -> viewer.familyId() != null
                        ? new MealPlanExclusion(recipe, familyRepository.getReferenceById(viewer.familyId()), null)
                        : new MealPlanExclusion(recipe, null, userRepository.getReferenceById(viewer.userId())))
                .toList();
        repository.saveAll(added);
    }
}
