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
        # Ensure card_index is integer
        card_index = int(card_index)
        
        if self.cards[card_index]['matched'] or self.cards[card_index]['flipped']:
            return {
                'valid': False,
                'message': 'Card is already flipped or matched'
            }
            
        self.cards[card_index]['flipped'] = True
        
        if self.first_card is None:
            self.first_card = card_index
            return {
                'valid': True,
                'card_index': card_index,
                'card_value': self.cards[card_index]['value'],
                'turn_complete': False,
                'message': 'Choose your second card'
            }
        
        # Second card
        second_card = card_index
        first_card_value = self.cards[self.first_card]['value']
        second_card_value = self.cards[second_card]['value']
        is_match = first_card_value == second_card_value
        
        result = {
            'valid': True,
            'first_card': self.first_card,
            'card_index': card_index,
            'card_value': second_card_value,
            'is_match': is_match,
            'turn_complete': True,
            'player_score': self.player_score,
            'message': 'Match!' if is_match else 'No match!'
        }
        
        if is_match:
            self.cards[self.first_card]['matched'] = True
            self.cards[second_card]['matched'] = True
            self.player_score += 1
        else:
            # Reset cards after delay (handled by frontend)
            self.cards[self.first_card]['flipped'] = False
            self.cards[second_card]['flipped'] = False
            
        self.first_card = None
        
        # Check if game is over
        if all(card['matched'] for card in self.cards):
            result['game_over'] = True
            result['message'] = f'Game Over! Score: {self.player_score}'
            
        return result
    
    def to_dict(self) -> Dict[str, Any]:
        # Ensure all numeric values are explicitly converted to int
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
