import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ToolboxSection } from './ncstateDetails';
import { colors } from './theme';

type Props = {
  description: string | null;
  sections: ToolboxSection[] | null;
  /** The user's USDA zone, highlighted in the hardiness zone row. */
  hardinessZone?: string | null;
  onDescriptionChange: (description: string) => void;
  onSectionsChange: (sections: ToolboxSection[]) => void;
};

const DESCRIPTION = 'Description';

export default function ToolboxSections({
  description,
  sections,
  hardinessZone,
  onDescriptionChange,
  onSectionsChange,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);

  if (description === null && !sections?.length) return null;

  function toggle(title: string) {
    setOpenSections((current) => ({ ...current, [title]: !current[title] }));
  }

  function editRow(sectionIndex: number, rowIndex: number, text: string) {
    if (!sections) return;
    onSectionsChange(
      sections.map((section, s) =>
        s !== sectionIndex
          ? section
          : {
              ...section,
              // One value per line, since values can themselves contain commas.
              rows: section.rows.map((row, r) => (r === rowIndex ? { ...row, values: text.split('\n') } : row)),
            },
      ),
    );
  }

  function header(title: string) {
    const open = openSections[title] ?? false;
    return (
      <Pressable
        style={styles.sectionHeader}
        onPress={() => toggle(title)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>NC State Plant Toolbox</Text>
        <Pressable onPress={() => setEditing((on) => !on)} hitSlop={12} accessibilityRole="button">
          <Text style={styles.editToggle}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      {description !== null && (
        <View style={styles.section}>
          {header(DESCRIPTION)}
          {openSections[DESCRIPTION] &&
            (editing ? (
              <TextInput
                style={[styles.input, styles.description]}
                value={description}
                onChangeText={onDescriptionChange}
                multiline
              />
            ) : (
              <Text style={styles.descriptionText}>{description}</Text>
            ))}
        </View>
      )}

      {sections?.map((section, sectionIndex) => (
        <View key={section.title} style={styles.section}>
          {header(section.title)}
          {openSections[section.title] &&
            section.rows.map((row, rowIndex) => {
              const values = row.values.filter((value) => value.trim().length > 0);
              if (!editing && values.length === 0) return null;
              return (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  {editing ? (
                    <TextInput
                      style={[styles.input, row.values.length > 1 && styles.multiline]}
                      value={row.values.join('\n')}
                      onChangeText={(text) => editRow(sectionIndex, rowIndex, text)}
                      multiline={row.values.length > 1}
                    />
                  ) : values.length > 1 ? (
                    <View style={styles.chips}>
                      {values.map((value) => {
                        const mine =
                          !!hardinessZone &&
                          /hardiness zone/i.test(row.label) &&
                          value.trim().toLowerCase() === hardinessZone.toLowerCase();
                        return (
                          <Text
                            key={value}
                            style={[styles.chip, mine && styles.chipMine]}
                            accessibilityLabel={mine ? `${value}, your zone` : undefined}
                          >
                            {value}
                          </Text>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.rowValue}>{values[0]}</Text>
                  )}
                </View>
              );
            })}
        </View>
      ))}

      <Text style={styles.attribution}>Source: NC State Extension Gardener Plant Toolbox</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  toolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  toolbarTitle: { color: colors.muted, fontSize: 13 },
  editToggle: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  descriptionText: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  rowValue: { color: colors.text, fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipMine: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 12,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  description: { height: 200, lineHeight: 22, marginBottom: 14, textAlignVertical: 'top' },
  section: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chevron: { color: colors.accent, fontSize: 20, fontWeight: '600' },
  row: { marginBottom: 14 },
  rowLabel: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  attribution: { color: colors.muted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },
});
