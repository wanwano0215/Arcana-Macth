import random
from typing import List, Dict, Any, Optional

class GameState:
    def __init__(self):
        self.cards = self._create_cards()
        self.player_score = 0
        self.first_card: Optional[int] = None
        
    def _create_cards(self) -> List[Dict[str, Any]]:
        # Create pairs of cards (1-22, each appears twice)
        values = list(range(1, 23)) * 2
        random.shuffle(values)
        return [{'value': v, 'flipped': False, 'matched': False} for v in values]
    
    def process_player_move(self, card_index: int) -> Dict[str, Any]:
        try:
            card_index = int(card_index)
            if not 0 <= card_index < len(self.cards):
                return {
                    'valid': False,
                    'message': '無効なカードです'
                }
            if self.cards[card_index]['matched']:
                return {
                    'valid': False,
                    'message': 'このカードは既にマッチしています'
                }
            if self.cards[card_index]['flipped']:
                return {
                    'valid': False,
                    'message': 'このカードは既にめくられています'
                }
        except ValueError:
            return {
                'valid': False,
                'message': '無効なカード番号です'
            }
            
        if self.first_card == card_index:
            return {
                'valid': False,
                'message': '同じカードは選択できません'
            }
        
        self.cards[card_index]['flipped'] = True
        
        if self.first_card is None:
            self.first_card = card_index
            return {
                'valid': True,
                'card_index': card_index,
                'card_value': self.cards[card_index]['value'],
                'turn_complete': False,
                'message': 'カードを2枚めくってください'
            }
        
        second_card = card_index
        first_card_value = self.cards[self.first_card]['value']
        second_card_value = self.cards[second_card]['value']
        is_match = first_card_value == second_card_value
        
        if is_match:
            self.cards[self.first_card]['matched'] = True
            self.cards[second_card]['matched'] = True
            self.player_score += 1
        
        result = {
            'valid': True,
            'first_card': self.first_card,
            'card_index': card_index,
            'card_value': second_card_value,
            'is_match': is_match,
            'turn_complete': True,
            'message': '🎉 Match! 🎉' if is_match else 'No match!'
        }
        
        if is_match:
            result['player_score'] = self.player_score
        
        if not is_match:
            self.cards[self.first_card]['flipped'] = False
            self.cards[second_card]['flipped'] = False
            
        self.first_card = None
        
        if all(card['matched'] for card in self.cards):
            result['game_over'] = True
            result['message'] = f'🎊 Game Clear! 🎊 Score: {self.player_score}'
            
        return result
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'cards': [{
                'value': int(card['value']),
                'flipped': bool(card['flipped']),
                'matched': bool(card['matched'])
            } for card in self.cards],
            'player_score': int(self.player_score),
            'first_card': int(self.first_card) if self.first_card is not None else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GameState':
        game_state = cls()
        game_state.cards = data['cards']
        game_state.player_score = int(data['player_score'])
        game_state.first_card = int(data['first_card']) if data['first_card'] is not None else None
        return game_state
