import random
from typing import List, Dict, Any
import time

class GameState:
    def __init__(self):
        self.cards = self._create_cards()
        self.player_score = 0
        self.cpu_score = 0
        self.first_card = None
        self.cpu_memory = {}  # Remember seen cards
        
    def _create_cards(self) -> List[Dict[str, Any]]:
        # Create pairs of cards (1-22, each appears twice)
        values = list(range(1, 23)) * 2
        random.shuffle(values)
        return [{'value': v, 'flipped': False, 'matched': False} for v in values]
    
    def process_player_move(self, card_index: int) -> Dict[str, Any]:
        if self.cards[card_index]['matched'] or self.cards[card_index]['flipped']:
            return {'valid': False}
            
        self.cards[card_index]['flipped'] = True
        self.cpu_memory[card_index] = self.cards[card_index]['value']
        
        if self.first_card is None:
            self.first_card = card_index
            return {
                'valid': True,
                'card_index': card_index,
                'card_value': self.cards[card_index]['value'],
                'turn_complete': False
            }
        
        # Second card
        second_card = card_index
        is_match = self.cards[self.first_card]['value'] == self.cards[second_card]['value']
        
        if is_match:
            self.cards[self.first_card]['matched'] = True
            self.cards[second_card]['matched'] = True
            self.player_score += 1
        else:
            # Reset cards after delay
            self.cards[self.first_card]['flipped'] = False
            self.cards[second_card]['flipped'] = False
            
        self.first_card = None
        
        return {
            'valid': True,
            'card_index': card_index,
            'card_value': self.cards[card_index]['value'],
            'is_match': is_match,
            'turn_complete': True,
            'player_score': self.player_score,
            'cpu_score': self.cpu_score
        }
    
    def cpu_play(self) -> Dict[str, Any]:
        # First try to match known pairs
        for i, value_i in self.cpu_memory.items():
            for j, value_j in self.cpu_memory.items():
                if i != j and value_i == value_j and not self.cards[i]['matched'] and not self.cards[j]['matched']:
                    self.cards[i]['flipped'] = True
                    self.cards[j]['flipped'] = True
                    self.cards[i]['matched'] = True
                    self.cards[j]['matched'] = True
                    self.cpu_score += 1
                    return {
                        'cpu_moves': [
                            {'index': i, 'value': value_i},
                            {'index': j, 'value': value_j}
                        ],
                        'cpu_match': True,
                        'cpu_score': self.cpu_score
                    }
        
        # If no known pairs, try random cards
        available = [i for i, card in enumerate(self.cards) if not card['matched']]
        if len(available) >= 2:
            moves = random.sample(available, 2)
            for i in moves:
                self.cards[i]['flipped'] = True
                self.cpu_memory[i] = self.cards[i]['value']
            
            if self.cards[moves[0]]['value'] == self.cards[moves[1]]['value']:
                self.cards[moves[0]]['matched'] = True
                self.cards[moves[1]]['matched'] = True
                self.cpu_score += 1
                return {
                    'cpu_moves': [
                        {'index': moves[0], 'value': self.cards[moves[0]]['value']},
                        {'index': moves[1], 'value': self.cards[moves[1]]['value']}
                    ],
                    'cpu_match': True,
                    'cpu_score': self.cpu_score
                }
            else:
                self.cards[moves[0]]['flipped'] = False
                self.cards[moves[1]]['flipped'] = False
                return {
                    'cpu_moves': [
                        {'index': moves[0], 'value': self.cards[moves[0]]['value']},
                        {'index': moves[1], 'value': self.cards[moves[1]]['value']}
                    ],
                    'cpu_match': False,
                    'cpu_score': self.cpu_score
                }
        return {'game_over': True}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'cards': self.cards,
            'player_score': self.player_score,
            'cpu_score': self.cpu_score,
            'first_card': self.first_card,
            'cpu_memory': self.cpu_memory
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GameState':
        game_state = cls()
        game_state.cards = data['cards']
        game_state.player_score = data['player_score']
        game_state.cpu_score = data['cpu_score']
        game_state.first_card = data['first_card']
        game_state.cpu_memory = data['cpu_memory']
        return game_state
