import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '../theme';

export function usePopupMenu() {
  const menuRef = useRef(null);

  const show = (items) => {
    if (menuRef.current) {
      menuRef.current.show(items);
    }
  };

  const hide = () => {
    if (menuRef.current) {
      menuRef.current.hide();
    }
  };

  return { show, hide, menuRef };
}

export function PopupMenu({ forwardRef }) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const itemsRef = useRef([]);

  const menuRef = useRef({
    show: (itemList) => {
      itemsRef.current = itemList;
      setVisible(true);
    },
    hide: () => {
      setVisible(false);
    },
  });

  if (forwardRef) {
    forwardRef.current = menuRef.current;
  }

  const handleItemPress = (item) => {
    setVisible(false);
    item.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => setVisible(false)}
      >
        <View
          style={[
            styles.menu,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {itemsRef.current.map((item, index) => (
            <Pressable
              key={index}
              style={[
                styles.menuItem,
                index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
              ]}
              onPress={() => handleItemPress(item)}
            >
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  menu: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
