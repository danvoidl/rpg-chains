import type { ProfileSheet } from '@rpg-chains/shared-types';
import { describeEffect } from '@/features/effects/describe-effect';
import { sheetUser } from '@/features/effects/effect-user';

interface SkillListProps {
  sheet: ProfileSheet;
}

/**
 * The class skills with what each costs and does, worked out for this character's attributes and
 * weapon; locked ones say the level that unlocks them.
 */
export function SkillList({ sheet }: SkillListProps) {
  const user = sheetUser(sheet);
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Habilidades</h3>
      <ul className="mt-1 space-y-2 text-sm">
        {sheet.skills.map((skill) => (
          <li key={skill.id} className={skill.unlocked ? '' : 'opacity-50'}>
            <p className="font-medium text-gray-900">
              {skill.name}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {skill.unlocked
                  ? `${skill.energyCost} de energia · recarga ${skill.cooldownRounds}`
                  : `libera no nível ${skill.unlockLevel}`}
              </span>
            </p>
            <p className="text-gray-700">{describeEffect(skill.effect, user)}</p>
            {skill.text && <p className="text-xs italic text-gray-500">{skill.text}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
