<template>
  <div class="duplicate-finder-modal">
    <div class="modal-content">
      <button class="close-button" @click="$emit('close')">&times;</button>
      <h2>重复项查找器</h2>

      <div class="content-area">
        <div v-if="duplicateCharacters.length > 0">
        <h3>重复的角色卡</h3>
        <div v-for="(group, groupIndex) in duplicateCharacters" :key="group.name" class="duplicate-group">
          <h4>{{ group.name }}</h4>
          <ul>
            <li v-for="char in group" :key="char.avatar" class="duplicate-item">
              <img :src="getAvatarUrl(char.avatar)" class="avatar" />
              <div class="info">
                <p><strong>文件名:</strong> {{ char.avatar }}</p>
                <p><strong>创建日期:</strong> {{ char.create_date || '未知' }}</p>
                <p><strong>上次聊天:</strong> {{ new Date(char.date_last_chat).toLocaleString() }}</p>
              </div>
              <div class="actions">
                <button
                  v-if="group.length === 1"
                  class="rename-btn"
                  @click="renameCharacter(char, group.name, groupIndex)"
                  :disabled="char.renaming"
                >
                  {{ char.renaming ? '重命名中...' : `重命名为 "${group.name}"` }}
                </button>
                <div class="delete-option">
                  <input type="checkbox" :id="'del-chat-' + char.avatar" v-model="char.deleteChatHistory" />
                  <label :for="'del-chat-' + char.avatar">同时删除聊天记录</label>
                </div>
                <button class="delete-btn" @click="deleteCharacter(char, groupIndex)">删除</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div v-else>
        <p>没有发现重复的角色卡。</p>
      </div>

      <hr />

      <div v-if="duplicateWorldbooks.length > 0">
        <h3>重复的世界书</h3>
        <div v-for="(group, groupIndex) in duplicateWorldbooks" :key="group.name" class="duplicate-group">
          <h4>{{ group.name }} ({{ group.count }} 个)</h4>
          <div class="info">
            <p>警告：无法区分同名世界书的详细信息。删除操作将移除所有同名文件。</p>
          </div>
          <button class="delete-btn" @click="handleDeleteWorldbook(group.name, groupIndex)">删除所有 "{{ group.name }}"</button>
        </div>
      </div>
        <div v-else>
          <p>没有发现重复的世界书。</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import _ from 'lodash';

const props = defineProps({
  initialCharacters: {
    type: Array as () => any[],
    required: true,
  },
  initialWorldbooks: {
    type: Array as () => any[],
    required: true,
  },
});

const emit = defineEmits(['close']);

const duplicateCharacters = ref<any[][]>([]);
const duplicateWorldbooks = ref<{ name: string, count: number }[]>([]);

onMounted(() => {
  // 为每个角色卡添加一个用于绑定复选框的状态
  const charactersWithState = _.cloneDeep(props.initialCharacters);
  charactersWithState.forEach(group => {
    group.forEach(char => {
      char.deleteChatHistory = false;
    });
  });
  duplicateCharacters.value = charactersWithState;
  duplicateWorldbooks.value = _.cloneDeep(props.initialWorldbooks);
});

function getAvatarUrl(avatar: string) {
  return `/characters/${encodeURIComponent(avatar)}`;
}

async function deleteCharacter(char: any, groupIndex: number) {
  const confirmMessage = `确定要删除角色卡 "${char.name}" (${char.avatar}) 吗？\n\n${
    char.deleteChatHistory ? '警告：相关的聊天记录也将被永久删除！' : '此操作将保留聊天记录。'
  }`;

  if (!confirm(confirmMessage)) {
    return;
  }
  try {
    // 使用 SillyTavern 提供的函数来获取包含 CSRF 令牌的请求头
    const headers = SillyTavern.getRequestHeaders();
    headers['Content-Type'] = 'application/json'; // 确保内容类型是 JSON

    const response = await fetch('/api/characters/delete', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ avatar_url: char.avatar, delete_chats: char.deleteChatHistory }),
    });
    if (response.ok) {
      toastr.success(`角色 "${char.name}" (${char.avatar}) 已删除。`);

      // 从酒馆全局角色列表中移除，确保状态同步
      const globalCharIndex = SillyTavern.characters.findIndex(c => c.avatar === char.avatar);
      if (globalCharIndex !== -1) {
        SillyTavern.characters.splice(globalCharIndex, 1);
      }

      // 更新UI列表
      const group = duplicateCharacters.value[groupIndex];
      const charIndex = group.findIndex(c => c.avatar === char.avatar);
      if (charIndex !== -1) {
        group.splice(charIndex, 1);
        if (group.length === 0) {
          duplicateCharacters.value.splice(groupIndex, 1);
        }
      }
    } else {
      throw new Error('删除失败');
    }
  } catch (error) {
    console.error(error);
    toastr.error(`删除角色 "${char.name}" 失败。`);
  }
}

async function handleDeleteWorldbook(name: string, groupIndex: number) {
  if (!confirm(`确定要删除所有名为 "${name}" 的世界书吗？\n这是一个不可逆的操作。`)) {
    return;
  }
  try {
    const success = await deleteWorldbook(name);
    if (success) {
      toastr.success(`世界书 "${name}" 已删除。`);
      duplicateWorldbooks.value.splice(groupIndex, 1);
    } else {
      throw new Error('世界书可能不存在或删除失败');
    }
  } catch (error) {
    console.error(error);
    toastr.error(`删除世界书 "${name}" 失败。`);
  }
}

async function renameCharacter(char: any, targetName: string, groupIndex: number) {
  char.renaming = true;
  try {
    const headers = SillyTavern.getRequestHeaders();
    headers['Content-Type'] = 'application/json';

    const response = await fetch('/api/characters/rename', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ avatar_url: char.avatar, new_name: targetName }),
    });

    if (!response.ok) {
      throw new Error(`服务器响应: ${response.status}`);
    }

    const result = await response.json();
    toastr.success(`角色已重命名为 "${result.avatar}"`);

    // 更新酒馆全局角色列表中的信息
    const globalChar = SillyTavern.characters.find(c => c.avatar === char.avatar);
    if (globalChar) {
      globalChar.name = targetName;
      globalChar.avatar = result.avatar;
    }

    // 从UI列表中移除整个分组，因为它不再是重复项了
    duplicateCharacters.value.splice(groupIndex, 1);

  } catch (error) {
    console.error(error);
    toastr.error(`重命名角色 "${char.name}" 失败。`);
    char.renaming = false;
  }
}
</script>

<style scoped>
.duplicate-finder-modal {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.modal-content {
  background: #333;
  color: #eee;
  padding: 20px;
  border-radius: 8px;
  width: 100%;
  max-width: 800px;
  max-height: 100%;
  position: relative;
  border: 1px solid #555;
  display: flex;
  flex-direction: column;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #eee;
  font-size: 24px;
  cursor: pointer;
}

.content-area {
  overflow-y: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .duplicate-finder-modal {
    padding: 10px;
  }
  .modal-content {
    padding: 15px;
  }
  
  .duplicate-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .avatar {
    margin-right: 0;
    margin-bottom: 10px;
  }
  
  .actions {
    align-items: flex-start;
    width: 100%;
    margin-top: 10px;
  }
}

h2, h3, h4 {
  color: #4caf50;
}

h3 {
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
}

.duplicate-group {
  margin-bottom: 20px;
  padding: 10px;
  background: #444;
  border-radius: 5px;
}

.duplicate-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #555;
}
.duplicate-item:last-child {
  border-bottom: none;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 15px;
  object-fit: cover;
}

.info {
  flex-grow: 1;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.delete-option {
  display: flex;
  align-items: center;
  font-size: 0.8em;
  color: #ccc;
}

.delete-option input {
  margin-right: 5px;
}

.info p {
  margin: 2px 0;
  font-size: 0.9em;
}

.delete-btn, .rename-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.delete-btn:hover {
  background-color: #d32f2f;
}

.rename-btn {
  background-color: #4CAF50; /* Green */
}

.rename-btn:hover {
  background-color: #45a049;
}

.rename-btn:disabled {
  background-color: #555;
  cursor: not-allowed;
}

hr {
  border: 1px solid #555;
  margin: 20px 0;
}
</style>